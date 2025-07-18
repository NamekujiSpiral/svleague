const firebaseConfig = {

  apiKey: "AIzaSyD-iPonivYybagsRqV2msiHpLUHAk7Ac2s",

  authDomain: "svleague-24842.firebaseapp.com",

  projectId: "svleague-24842",

  storageBucket: "svleague-24842.firebasestorage.app",

  messagingSenderId: "994403095545",

  appId: "1:994403095545:web:7f10c521b48cb90a51e328",

  measurementId: "G-5DRCXL5LHQ"

};


// Firebaseを初期化する
firebase.initializeApp(firebaseConfig);

// Firestoreデータベースのインスタンスをグローバルに作成する
const db = firebase.firestore();
