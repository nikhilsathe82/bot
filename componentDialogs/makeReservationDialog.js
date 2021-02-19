const { WaterfallDialog, ComponentDialog } = require('botbuilder-dialogs');

const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');

const {DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_PROMPT';

var endDialog = '';

class MakeReservationDialog extends ComponentDialog {

    constructor(conversationState, userState) { //convstate and convdata is being passed so that comp dialog is aware of our current conv state and usermain dialog state
        super('makeReservationDialog'); //dialogid for the class makereservationdialog
        this.conversationState = conversationState;
        this.userState = userState;

        //create waterfall steps in the dialog and add them all in a dialogset. 
        //add prompt type dialogs first. creation of diff prompt objects
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT), this.noOfParticipantsValidator);
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        //creating waterfalldialog consisting of differen steps to gather info for restaurant reservation
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            //under waterfall diaglog we are defining different steps that will run in sequential order
            this.firstStep.bind(this), //as confirmation if user wants to make reservation
            this.getName.bind(this), // get name from  user
            this.getNumberOfParticipants.bind(this), // number of participants for reservation
            this.getDate.bind(this), // date of reservation
            this.getTime.bind(this), //time of reservation
            this.confirmStep.bind(this), //show summary of values entered by user and ask confirmation to make reservation
            this.summaryStep.bind(this)

        ]));



        this.initialDialogId = WATERFALL_DIALOG;

    }

    //run method handles the incoming activi in the form of turn context and passes it thru dialog sys.
    //override the run method provided by component dialog. run method is used to create and access dialogcontext
    //forwarding turncontext created by adapter in main dialog to component dialog
    //accessor is a state property accessor for that state dialog property
    //below accessor is to access diff. props which we are going to save in diaglog state obj.
    // since component dialog are inner dialog set. we must create a outer dialog set visible to activityhandler code and use that to create dialogcontext
    //pass accessor from main dialog to run method of this makereservatiodialog. accessor keeps track of this dialog
    async run(turnContext, accessor, entities) {
        const dialogSet = new DialogSet(accessor); //create dialogset using dialogset component. accessor to access teh state of that dialog
        dialogSet.add(this); //add all the dialogs defined in the constructor to the dialogset
        const dialogContext = await dialogSet.createContext(turnContext); // dialogcontext is getting created using createcontext of dialogSet and we are passing turncontext
        //turncontext is visible by activityhandler in main dialog. but we need a diffrent dialogcontext that is visible to all 
        //steps defined under component dialog  
        //check if the dialog was active when user lands in comp dialog   
        // to check if previous dialog was active or not. if no previous active dialog then starts waterfall dialog
        // if dialog was active or on particular step, then starts the waterfall dialog from that step
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            console.log(this.id);
            await dialogContext.beginDialog(this.id, entities); //we are passing turncontext from adapter to componentdialog. pass entities to first step of wfd. 
            // we are passing turncontext to dialogset returning it to dialogcontext
            console.log(entities);
        }
        //turncontext is further passed to all component dialogs and conversation is managed.
    }

    async firstStep(step) {
        //check and save if noOfParticipants value is received in entities through info options
        
        step.values.noOfParticipants =  step._info.options.noOfParticipants[0];
        console.log(step.values.noOfParticipants);
        endDialog = false; //local value and not property accessor
        //Running a prompt here means the next waterfallstep will run when the user response is received
        return await step.prompt(CONFIRM_PROMPT, 'Would you like to make a reservation', ['Yes', 'No']);

    }

    async getName(step) {
        console.log(step.result);
        // if user enters yes in above step
        if (step.result === true) {
            return await step.prompt(TEXT_PROMPT, 'In whose name reservation is to be made?');
        }

        // if user enters No in above step
        if (step.result === false) {
            await step.context.sendActivity("You chose not to go ahead with reservation");
            endDialog = true;
            return await step.endDialog();
        }
    }

    async getNumberOfParticipants(step) {
        step.values.name = step.result;

        //present this only if we have not received any value in noofparticipants from entities
        if(!step.values.noOfParticipants)
        {
            return await step.prompt(NUMBER_PROMPT, 'How many participants (0-150)?');
        }
        else{
            return await step.continueDialog(); //continue the dialog
        }
        
    }

    async getDate(step) {

        //save value of noofparticipants only if we do not get it from entities
        if(!step.values.noOfParticipants)
        step.values.noOfParticipants = step.result;

        return await step.prompt(DATETIME_PROMPT, 'On which date you want to make the reservation?');
    }

    async getTime(step) {
        step.values.date = step.result;
        return await step.prompt(DATETIME_PROMPT, 'At what time you want to make the reservation?');
    }

    async confirmStep(step) {
        step.values.time = step.result;
        var msg = `You have entered following values: \n Name: ${step.values.name} \n Participants: ${JSON.stringify(step.values.noOfParticipants)} \n Date: ${JSON.stringify(step.values.date)} \n Time: ${JSON.stringify(step.values.time)}`;
        // send all values collected from user and display in chat
        await step.context.sendActivity(msg);
        return await step.prompt(CONFIRM_PROMPT, 'Are you sure above details are correct and you want to make reservation', ['Yes', 'No']);
    }

    async summaryStep(step) {
        if (step.result === true) {
            //business logic
            await step.context.sendActivity("Reservation successfully made. Your reservation id is : 12322");
            // to indicate that the reservation dialog has ended after our waterfall dialog has ended
            endDialog = true;
            return await step.endDialog();
        }


    }
    async noOfParticipantsValidator(promptContext) {
        //This condition is our validation rule. You can also change the value at this point.
        return promptContext.recognized.succeeded && promptContext.recognized.value > 1 && promptContext.recognized.value < 150;
    }

    //to return this enddialog value to rrbot
    async isDialogComplete(){
        return endDialog;
    }
}

module.exports.MakeReservationDialog = MakeReservationDialog;