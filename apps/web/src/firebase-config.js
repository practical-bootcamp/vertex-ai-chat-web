/**
 * To find your Firebase config object:
 * 
 * 1. Go to your [Project settings in the Firebase console](https://console.firebase.google.com/project/_/settings/general/)
 * 2. In the "Your apps" card, select the nickname of the app for which you need a config object.
 * 3. Select Config from the Firebase SDK snippet pane.
 * 
 * 4. Copy the config object snippet, then add it here.
 */
const config = {
  apiKey: "AIzaSyDql14X2_6qA8wP9IXWydHkCDRgNYHt65o",
  authDomain: "vertex-ai-chat-apps5.firebaseapp.com",
  projectId: "vertex-ai-chat-apps5",
  storageBucket: "vertex-ai-chat-apps5.appspot.com",
  messagingSenderId: "245229598585",
  appId: "1:245229598585:web:813a02e2efdbc2b688a1a8"
};

export function getFirebaseConfig() {
  if (!config || !config.apiKey) {
    throw new Error('No Firebase configuration object provided.' + '\n' +
    'Add your web app\'s configuration object to firebase-config.js');
  } else {
    return config;
  }
}