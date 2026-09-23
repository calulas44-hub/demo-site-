/* ============================================================================
   PALANDÖKEN 25 – Configuration Firebase
   ----------------------------------------------------------------------------
   Ce site partage le MÊME projet Firebase que MYKONOS, mais toutes ses données
   (commandes, menu, clients, newsletter) sont rangées sous un préfixe séparé
   « palandoken/ » dans la base de données. Résultat : les deux restaurants
   utilisent le même compte Firebase SANS JAMAIS mélanger leurs données —
   une commande Palandöken ne s'affiche pas chez Mykonos, et inversement.
   (Le préfixe est appliqué automatiquement dans firebase-sync.js.)

   Valeurs PUBLIQUES (prévues par Firebase pour être exposées côté client).
   ==========================================================================*/
window.PALANDOKEN_FIREBASE = {
  apiKey: "AIzaSyBo9hpHKMAUb9A4sR1oBE1KieH1DEJMJK4",
  authDomain: "mykonos-5a78c.firebaseapp.com",
  databaseURL: "https://mykonos-5a78c-default-rtdb.firebaseio.com",
  projectId: "mykonos-5a78c",
  storageBucket: "mykonos-5a78c.firebasestorage.app",
  messagingSenderId: "450430965713",
  appId: "1:450430965713:web:fe1cd3fb23416ed0c832f0",
  measurementId: "G-2LHD613GPS"
};
