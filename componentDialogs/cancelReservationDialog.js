const { WaterfallDialog, ComponentDialog } = require('botbuilder-dialogs');

const { ConfirmPrompt, ChoicePrompt, DateTimePrompt, NumberPrompt, TextPrompt } = require('botbuilder-dialogs');

const {DialogSet, DialogTurnStatus } = require('botbuilder-dialogs');

const { CardFactory } = require ('botbuilder'); 

const RestaurantCard = require('../resources/adaptiveCards/Restaurantcard.json');

//create an array and put all adaptive cards in that
const CARDS = [
   RestaurantCard
];

const CHOICE_PROMPT = 'CHOICE_PROMPT';
const CONFIRM_PROMPT = 'CONFIRM_PROMPT';
const TEXT_PROMPT = 'TEXT_PROMPT';
const NUMBER_PROMPT = 'NUMBER_PROMPT';
const DATETIME_PROMPT = 'DATETIME_PROMPT';
const WATERFALL_DIALOG = 'WATERFALL_PROMPT';

var endDialog = '';

class CancelReservationDialog extends ComponentDialog {

    constructor(conversationState, userState) { //convstate and convdata is being passed so that comp dialog is aware of our current conv state and usermain dialog state
        super('cancelReservationDialog'); //dialogid for the class makereservationdialog
        this.conversationState = conversationState;
        this.userState = userState;

        //create waterfall steps in the dialog and add them all in a dialogset. 
        //add prompt type dialogs first. creation of diff prompt objects
        this.addDialog(new TextPrompt(TEXT_PROMPT));
        this.addDialog(new ChoicePrompt(CHOICE_PROMPT));
        this.addDialog(new ConfirmPrompt(CONFIRM_PROMPT));
        this.addDialog(new NumberPrompt(NUMBER_PROMPT));
        this.addDialog(new DateTimePrompt(DATETIME_PROMPT));

        //creating waterfalldialog consisting of different steps to gather info for restaurant reservation
        this.addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
            //under waterfall diaglog we are defining different steps that will run in sequential order
            this.firstStep.bind(this), //as confirmation if user wants to make reservation
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
    async run(turnContext, accessor) {
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
            await dialogContext.beginDialog(this.id); //we are passing turncontext from adapter to componentdialog
            // we are passing turncontext to dialogset returning it to dialogcontext
        }
        //turncontext is further passed to all component dialogs and conversation is managed.
    }

    async firstStep(step) {
        endDialog = false; //local value and not property accessor
        //Running a prompt here means the next waterfallstep will run when the user response is received
        // return await step.prompt(CONFIRM_PROMPT, 'Would you like to make a reservation', ['Yes', 'No']);
        
        // adaptive cards are send as attachments in context obj sendactivity method
        await step.context.sendActivity({
            text: "Enter reservation id for cancellation",
            attachments: [CardFactory.adaptiveCard(CARDS[0])]
        });

        return await step.prompt(TEXT_PROMPT,'');

    }


    async confirmStep(step) {
        step.values.reservationNo = step.result;
        var msg = `You have entered following values: \n Name: ${step.values.reservationNo}`;
        // send all values collected from user and display in chat
        await step.context.sendActivity(msg);
        return await step.prompt(CONFIRM_PROMPT, 'Are you sure above details are correct and you want to cancel the reservation', ['Yes', 'No']);
    }

    async summaryStep(step) {
        if (step.result === true) {
            //business logic
            await step.context.sendActivity("Reservation successfully cancelled.");
            // to indicate that the reservation dialog has ended after our waterfall dialog has ended
            endDialog = true;
            return await step.endDialog();
        }
    }

    async isDialogComplete() {
        return endDialog;
    }
    
}

module.exports.CancelReservationDialog = CancelReservationDialog;