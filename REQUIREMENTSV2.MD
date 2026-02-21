*** Notificaton system *** 

Players must receive both in app and sms messages to help the game progress in a timely manner. Our goal here is to make sure we progress the game but do not overload or innundate people with alerts. 

> Notification has 3 modes editable in commissioner tools: 
* None - only in UI alerts displayed in the bell 
* Low - Minimum amount of notifications provided to attempt to progress the game 
* High - Verbose amount of notifications provided to help a user follow along from sms alerts 

> Stages of notifications 

All notifications should be displayed in a drop down from the bell in the UI regardless of settings. 

The following should be sent SMS to the players provided phone number based on the notification setting

* Title: You're up - time to submit a question 
   setting: low and high 
   recipient: at bat player
* Title: New question is ready - get your bets in
   setting: Low and High
   recipient: all players but the at bat 
* Title: Answer submitted 
   Setting: High 
   Recipient: at bat player
* Title: You're about to be skipped - get your bet in soon 
   Setting: High 
   Recipient: last player that hasn't submitted a bet and answer 
* Title: You're on deck, start preparing a question, queue one in advance if you need to. 
   Setting: Low 
   Recipient: On Deck player
* Title: All questions submitted - time to grade 
   Setting: Low and high 
   Recipient: at bat player 
* Title: Round results
   Setting: High 
   Recipient: All players

> Contents of notifications 

1. Title of notification provided above. 
2. Short link that matchese the link provided in the round UI that the player can click on. Append additional details so that we can measure if the player is coming to the UI from the notification. 

> Edge cases 

if a player leaves or is removed from a game they must not receive notifications going forward 

> Monitoring of success 

In Super admin dashboard we need to track. 
1. total # of notifications sent 
2. total # of people that followed the short link from a navigation

We also need a global setting here to configure notifications for all games. This should override commissioner game setting just in case we need to account for notifications gone wild. We basically need to be able to set all games to none and then return them to their commissioner setting. So probably have two settings here: 
1. None 
2. Commissioner specified 

> Configuration of notification system 

We'll need a global configuration to point to the sms service of choice. We need this in case we need to use a different service. 

> Player profile 

A player should be able to override the game settings in player profile to the choice above. They can select none if they they only want UI notifications or Low/High as an example. 