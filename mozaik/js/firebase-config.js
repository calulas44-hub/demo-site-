/* ============================================================================
   MOZAÏK – Configuration Firebase
   ----------------------------------------------------------------------------
   Même projet Firebase que MYKONOS (comme Palandöken 25), mais TOUTES les
   données de Mozaïk (commandes, carte, clients, newsletter, photos, numéros
   de commande) sont rangées sous le préfixe « mozaik/ » de la base : aucune
   donnée n'est mélangée avec les autres restaurants.
   Pour utiliser un projet Firebase dédié, remplacez simplement ces valeurs.

   Valeurs PUBLIQUES (prévues par Firebase pour être exposées côté client).
   Si ce fichier est vide, le site fonctionne en local (localStorage).
   ==========================================================================*/
window.MOZAIK_FIREBASE = {
  apiKey: "AIzaSyBo9hpHKMAUb9A4sR1oBE1KieH1DEJMJK4",
  authDomain: "mykonos-5a78c.firebaseapp.com",
  databaseURL: "https://mykonos-5a78c-default-rtdb.firebaseio.com",
  projectId: "mykonos-5a78c",
  storageBucket: "mykonos-5a78c.firebasestorage.app",
  messagingSenderId: "450430965713",
  appId: "1:450430965713:web:fe1cd3fb23416ed0c832f0",
  measurementId: "G-2LHD613GPS"
};
