// config.js
// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC6MfcnmsjBh_7l5tgDH3u5PhvaXZY283g",
    authDomain: "chatup-ce15b.firebaseapp.com",
    databaseURL: "https://chatup-ce15b-default-rtdb.firebaseio.com",
    projectId: "chatup-ce15b",
    storageBucket: "chatup-ce15b.firebasestorage.app",
    messagingSenderId: "554087466726",
    appId: "1:554087466726:web:d84675aeca261c82155d27",
    measurementId: "G-29TWJQTPGE"
};

// Inicializar Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();
    
    // Tornar database global para outros scripts
    window.database = database;
    console.log('✅ Firebase configurado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao configurar Firebase:', error);
}