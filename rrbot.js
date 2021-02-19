// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { MakeReservationDialog } = require('./componentDialogs/makeReservationDialog');

const { CancelReservationDialog } = require('./componentDialogs/cancelReservationDialog');

// add luis recognizer in our bot
const { LuisRecognizer, QnAMaker } = require('botbuilder-ai');




class RRBot extends ActivityHandler {
    constructor(conversationState, userState) {
        super();

        // add global state management objects  for convstate and userstate obj
        this.conversationState = conversationState;
        this.userState = userState;

        //create dialogstate property accessor that can manage status of parti dialog. we will pass this dialogstate prop in run method of makereservationdialog
        this.dialogState = this.conversationState.createProperty("dialogState");

        //define global obj of makereser and cancelreser
        this.makeReservationDialog = new MakeReservationDialog(this.conversationState, this.userState);
        this.cancelReservationDialog = new CancelReservationDialog(this.conversationState, this.userState);


        //define property accessor. first is to maintaint the current topic or intent. save the value of current conv dialog going on.
        this.previousIntent = this.conversationState.createProperty("previousIntent");
        // save other conversations state related data create one general property accessor convdata
        this.conversationData = this.conversationState.createProperty("conversationData");

        //recognizer for luis
        const dispatchRecognizer = new LuisRecognizer({
            applicationId: process.env.LuisAppId,
            endpointKey: process.env.LuisAPIKey,
            endpoint: `https://${process.env.LuisAPIHostName}.api.cognitive.microsoft.com`
        }, {
            includeAllIntents: true
        }, true);

        //recognizer for qnamaker
        const qnaMaker = new QnAMaker({
            knowledgeBaseId: process.env.QnAKnowledgebaseId,
            endpointKey: process.env.QnAEndpointKey,
            host: process.env.QnAEndpointHostName
        });

        // create a global obj for qnamaker as we have to use it outside the constructor
        this.qnaMaker = qnaMaker;

        // See https://aka.ms/about-bot-activity-message to learn more about the message and other activity types.
        this.onMessage(async (context, next) => {
            // const replyText = `Echo: ${ context.activity.text }`;
            // await context.sendActivity(MessageFactory.text(replyText, replyText));

            // use dispatchrecog to connect to luis app and fetch results for incoming activity and store in luisresult
            const luisResult = await dispatchRecognizer.recognize(context);
            //fetch the top intent from the luis recognizer
            const intent = LuisRecognizer.topIntent(luisResult);
            console.log(luisResult);

            // saving entities from luisresult 
            const entities = luisResult.entities;
            
            // push all incoming activities to this method with context
            await this.dispatchToIntentAsync(context,intent, entities);



            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        // to save our convstate and userstate everytime dialog is being loaded. after 
        //each step of dialog we need to save convstate which in turn saves dialogstate
        //ondialog listener is called everytime a new dialog is initiated
        this.onDialog(async (context, next) => {
            //save any state changes that happens during execution of dialog. the load happened during the execution of the dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);
            await next();
        })

        this.onMembersAdded(async (context, next) => {
            // const membersAdded = context.activity.membersAdded;
            // const welcomeText = 'Hello and welcome!';
            // for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            //     if (membersAdded[cnt].id !== context.activity.recipient.id) {
            //         await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            //     }
            // }
            await this.sendWelcomeMessage(context);
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }


    async sendWelcomeMessage(turnContext) {
        const { activity } = turnContext;

        //iterate over all new members added to the conversation
        for (const idx in activity.membersAdded) {
            if (activity.membersAdded[idx].id !== activity.recipient.id) {
                const welcomeMessage = `Welcome to Restaurant Reservation Bot ${activity.membersAdded[idx].name}.`;
                await turnContext.sendActivity(welcomeMessage);
                await this.sendSuggestedActions(turnContext);
            }
        }
    }

    async sendSuggestedActions(turnContext) {
        var reply = MessageFactory.suggestedActions(['Make Reservation', 'Cancel Reservation', 'Restaurant Address'], 'what would you like to do today?');
        await turnContext.sendActivity(reply);

    }

    async dispatchToIntentAsync(context, intent, entities) {

        // 
        var currentIntent = '';
        // Get the state properties from the context
        const previousIntent = await this.previousIntent.get(context, {}); //fetch default prop accessor value for previous intent
        const conversationData = await this.conversationData.get(context, {});

        // if previous intent is present and previous dialog is not ended and going on
        if (previousIntent.intentName && conversationData.endDialog === false) {
            //if previous dialog is already running set current intent as previous intent
            currentIntent = previousIntent.intentName;
        } // if previous topic is running and previous waterfall dialog has ended.
        else if (previousIntent.intentName && conversationData.endDialog === true) {
            // set currentintent to intent from luis app we have currently received. we can use this to initiate new dialog.
            currentIntent = intent;

        } //check if intent is none and if no previous intentname is set. qnamaker case 
        else if (intent == 'none' && !previousIntent.intentName)
        {
            var result = await this.qnaMaker.getAnswers(context);//context will have incoming query from user which is saved in result
            // since result in json format, take answer from result
            await context.sendActivity(`${result[0].answer}`);
            await this.sendSuggestedActions(context);
        }
        else {
            //there is no running topic.
            currentIntent = intent; //topic we have just received.
            // if user selects make reservation, then we are setting the currentintent as this topic. and setting previousintent.intentname value as make reservation
            await this.previousIntent.set(context, { intentName: intent });
        }

        switch (currentIntent) {


            case "Make_Reservation":
                console.log("Inside make reservation case")
                //set enddialog property accessor as false as we are going to start dialog in next step
                await this.conversationData.set(context, { endDialog: false });
                // start dialog
                await this.makeReservationDialog.run(context, this.dialogState, entities);
                // once above dialog is complete, we check if value of enddialog is true or false
                conversationData.endDialog = await this.makeReservationDialog.isDialogComplete();
                // if makereservationdialog. enddialog is complete
                if (conversationData.endDialog) {
                    await this.previousIntent.set(context, { intentName: null });
                    await this.sendSuggestedActions(context);
                }
                break;

            case "Cancel_Reservation":
                console.log("Inside cancel reservation case")
                //set enddialog property accessor as false as we are going to start new dialog in next step
                await this.conversationData.set(context, { endDialog: false });
                // start cancel reservation dialog
                await this.cancelReservationDialog.run(context, this.dialogState)
                //once cancel reser dialog is complete, we are checking if dialog is ended or not by invoking isdialogcomplete method
                conversationData.endDialog = await this.cancelReservationDialog.isDialogComplete();
                // if cancelreservationdialog is complete
                if (conversationData.endDialog) {
                    await this.previousIntent.set(context, { intentName: null });
                    await this.sendSuggestedActions(context);
                }
                break;

            default:
                console.log("Did not match Make Reservation case");
                break;
        }

    }

}

module.exports.RRBot = RRBot;
