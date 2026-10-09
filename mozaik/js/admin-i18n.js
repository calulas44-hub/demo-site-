/* ============================================================================
   MOZAÏK – Traduction turque de l'espace gérant (admin-i18n.js)
   ----------------------------------------------------------------------------
   Bouton FR / TR dans l'admin. En turc, tous les textes de l'interface
   (menus, boutons, tableaux, messages, confirmations) sont traduits à
   l'affichage. Les DONNÉES ne sont jamais modifiées : la carte, les contenus
   du site client, les noms saisis restent tels quels (le site client reste en
   français) ; les statuts et moyens de paiement enregistrés restent identiques
   en base, seule leur étiquette affichée change. Tickets PDF et exports CSV
   restent en français (comptabilité française).
   ==========================================================================*/
(function (global) {
  'use strict';
  var KEY = 'mozaik_admin_lang';
  var lang = 'fr';
  try { lang = localStorage.getItem(KEY) === 'tr' ? 'tr' : 'fr'; } catch (e) {}

  /* ---------------- Textes exacts ---------------- */
  var EXACT = {
    // Titre, connexion, navigation
    'MOZAÏK — Espace gérant': 'MOZAÏK — Yönetici paneli',
    'Espace gérant': 'Yönetici paneli', 'ESPACE GÉRANT': 'YÖNETİCİ PANELİ',
    "Code d'accès": 'Erişim kodu', 'Entrer': 'Giriş', 'Code incorrect.': 'Kod yanlış.', '← Retour au site': '← Siteye dön',
    'Service': 'Servis', 'Tableau de bord': 'Kontrol paneli', 'Commandes en cours': 'Aktif siparişler',
    'Historique': 'Geçmiş', 'Historique des commandes': 'Sipariş geçmişi', 'Carte': 'Menü',
    'Produits': 'Ürünler', 'Catégories': 'Kategoriler', 'Options & suppléments': 'Seçenekler ve ekstralar',
    'Suggestions panier': 'Sepet önerileri', 'Suggestions du panier': 'Sepet önerileri',
    'Salle & clients': 'Salon ve müşteriler', 'Tables & QR codes': 'Masalar ve QR kodları',
    'Offres & codes promo': 'Kampanyalar ve indirim kodları', 'Clients': 'Müşteriler', 'Newsletter': 'Bülten',
    'Gestion': 'Yönetim', 'Comptabilité': 'Muhasebe', 'Tickets de caisse': 'Kasa fişleri', 'Site': 'Site',
    'Contenus du site': 'Site içerikleri', 'Réglages': 'Ayarlar', 'Voir le site ↗': 'Siteyi gör ↗', 'Déconnexion': 'Çıkış yap',
    '🟢 En direct': '🟢 Canlı', '⚪ Local': '⚪ Yerel', '🟠 Reconnexion…': '🟠 Yeniden bağlanıyor…',
    '🔔 Son activé': '🔔 Ses açık', '🔕 Son coupé': '🔕 Ses kapalı', 'Enregistré ✓': 'Kaydedildi ✓', 'Enregistré': 'Kaydedildi',
    'Synchronisation temps réel': 'Gerçek zamanlı senkronizasyon',
    'Alerte sonore + notification à chaque nouvelle commande': 'Her yeni siparişte sesli uyarı + bildirim',
    'Menu': 'Menü', 'Nom': 'Ad',

    // Tableau de bord
    'CA du jour (TTC)': 'Bugünkü ciro (KDV dahil)', 'Commandes du jour': 'Bugünkü siparişler', 'Panier moyen': 'Ortalama sepet',
    "Encaissé aujourd'hui": 'Bugün tahsil edilen', 'Nouvelles commandes': 'Yeni siparişler', '📋 À compléter': '📋 Tamamlanacaklar',
    'Saisir les prix': 'Fiyatları gir', 'Ajouter': 'Ekle',
    'Catégorie « Brunch & salé » (annoncée sur Instagram) à compléter : aucun produit ni prix publié.': '« Brunch & salé » kategorisi (Instagram’da duyurulan) tamamlanmalı: henüz ürün ya da fiyat yok.',
    "Code d'accès par défaut": 'Varsayılan erişim kodu', ': changez-le.': ': lütfen değiştirin.',
    'E-mail de contact non renseigné.': 'İletişim e-postası girilmemiş.',
    'Téléphone et horaires repris des fiches publiques (Google, Instagram) : à vérifier.': 'Telefon ve çalışma saatleri herkese açık kaynaklardan (Google, Instagram) alındı: kontrol edin.',
    "C'est vérifié ✓": 'Kontrol edildi ✓',
    'Synchronisation temps réel inactive': 'Gerçek zamanlı senkronizasyon kapalı',
    ': les commandes passées sur les téléphones ne remontent pas ici (vérifiez la connexion / la configuration Firebase).': ': telefonlardan verilen siparişler buraya gelmiyor (bağlantıyı / Firebase ayarlarını kontrol edin).',
    'Ouvrir le tableau de service →': 'Servis ekranını aç →',
    'N°': 'No', 'Table / mode': 'Masa / servis', 'Client': 'Müşteri', 'Reçue': 'Alındı', 'Total': 'Toplam',
    'Statut': 'Durum', 'Paiement': 'Ödeme', 'Voir': 'Gör', 'Aucune commande en cours.': 'Aktif sipariş yok.',
    '☕ Ventes du jour par produit': '☕ Ürüne göre bugünkü satışlar', "Pas encore de vente aujourd'hui.": 'Bugün henüz satış yok.',
    '🔔 Alerte des commandes': '🔔 Sipariş uyarısı',
    'Gardez cette page ouverte au comptoir : une': 'Bu sayfayı tezgâhta açık tutun: her yeni siparişte (masa QR kodu veya site) bir',
    'clochette': 'zil sesi',
    "retentit et une notification s'affiche à chaque nouvelle commande (QR code de table ou site). Cliquez une fois sur la page pour autoriser le son. Les commandes annulées sont exclues du CA ; les remboursements sont déduits du CA et des encaissements.": 'çalar ve bir bildirim görünür. Sese izin vermek için sayfaya bir kez tıklayın. İptal edilen siparişler ciroya dahil edilmez; iadeler ciro ve tahsilattan düşülür.',

    // Statuts & filtres
    'Nouvelle': 'Yeni', 'En préparation': 'Hazırlanıyor', 'Prête': 'Hazır', 'Servie': 'Servis edildi', 'Terminée': 'Tamamlandı',
    'Annulée': 'İptal edildi', 'En cours': 'Aktif', 'Nouvelles': 'Yeni', 'Prêtes': 'Hazır', 'À encaisser': 'Tahsil edilecek',
    "Toutes (aujourd'hui)": 'Tümü (bugün)', 'Servies': 'Servis edilenler', 'Annulées': 'İptal edilenler',
    'Rechercher : n°, prénom, table, produit…': 'Ara: no, ad, masa, ürün…',
    'Aucune commande ici pour le moment. Les nouvelles commandes apparaissent automatiquement.': 'Şu an burada sipariş yok. Yeni siparişler otomatik olarak görünür.',
    'Servie / remise (Terminée)': 'Servis edildi / teslim edildi (Tamamlandı)',

    // Carte de commande & actions
    'Lancer la préparation →': 'Hazırlamaya başla →', 'Marquer prête →': 'Hazır olarak işaretle →', 'Servie / remise →': 'Servis edildi / teslim edildi →',
    'Encaisser': 'Tahsil et', 'Rembourser': 'İade et', '🖨️ Bon': '🖨️ Fiş', 'Détails': 'Detaylar',
    '💶 À encaisser': '💶 Tahsil edilecek', 'Non payée': 'Ödenmedi', '↩︎ Remboursée': '↩︎ İade edildi',
    'Montant :': 'Tutar:', '🎓 Réduction étudiante appliquée : vérifiez la carte.': '🎓 Öğrenci indirimi uygulandı: kartı kontrol edin.',
    '💳 Carte (TPE)': '💳 Kart (POS)', '💶 Espèces': '💶 Nakit', '🎫 Titre-restaurant': '🎫 Yemek çeki', 'Autre': 'Diğer',
    'Annuler': 'Vazgeç', 'Montant à rembourser (€)': 'İade tutarı (€)', 'Remboursé par': 'İade yöntemi', 'Motif': 'Neden',
    'Erreur de commande, geste commercial…': 'Sipariş hatası, ikram…', 'Enregistrer le remboursement': 'İadeyi kaydet',
    "La commande sera exclue du chiffre d'affaires. Le client voit l'annulation dans son suivi.": 'Sipariş cirodan çıkarılacak. Müşteri iptali sipariş takibinde görür.',
    'Motif (facultatif)': 'Neden (isteğe bağlı)', 'Rupture, client parti…': 'Ürün kalmadı, müşteri ayrıldı…',
    'Retour': 'Geri', 'Annuler la commande': 'Siparişi iptal et', 'Montants': 'Tutarlar', 'Sous-total': 'Ara toplam',
    'Remboursé': 'İade edilen', 'Net': 'Net', 'Remboursements': 'İadeler', '🧾 Ticket PDF': '🧾 PDF fiş',
    "Annuler l'encaissement": 'Tahsilatı geri al', 'Supprimer définitivement': 'Kalıcı olarak sil', 'Fermer': 'Kapat',
    'Espèces': 'Nakit', 'Carte bancaire (TPE)': 'Banka kartı (POS)', 'Titre-restaurant': 'Yemek çeki',
    'Paiement sur place': 'Yerinde ödeme', 'Carte (en ligne)': 'Kart (online)',
    'Sur place': 'Kafede', 'À emporter': 'Paket', 'Livraison': 'Teslimat',

    // Périodes
    "Aujourd'hui": 'Bugün', 'Hier': 'Dün', '7 jours': '7 gün', '30 jours': '30 gün', 'Ce mois': 'Bu ay', 'Cette année': 'Bu yıl',
    'Cette semaine': 'Bu hafta', '7 derniers jours': 'Son 7 gün', '30 derniers jours': 'Son 30 gün',
    'Mois précis': 'Belirli ay', 'Période — du': 'Dönem — başlangıç', 'au': 'bitiş', 'Période :': 'Dönem:',
    'Janvier': 'Ocak', 'Février': 'Şubat', 'Mars': 'Mart', 'Avril': 'Nisan', 'Mai': 'Mayıs', 'Juin': 'Haziran', 'Juillet': 'Temmuz',
    'Août': 'Ağustos', 'Septembre': 'Eylül', 'Octobre': 'Ekim', 'Novembre': 'Kasım', 'Décembre': 'Aralık',
    'Lundi': 'Pazartesi', 'Mardi': 'Salı', 'Mercredi': 'Çarşamba', 'Jeudi': 'Perşembe', 'Vendredi': 'Cuma', 'Samedi': 'Cumartesi', 'Dimanche': 'Pazar',

    // Historique
    'Rechercher : n°, client, téléphone, e-mail, produit…': 'Ara: no, müşteri, telefon, e-posta, ürün…',
    'Tous statuts': 'Tüm durumlar', 'Tous paiements': 'Tüm ödemeler', 'Payées': 'Ödenenler', 'Remboursées': 'İade edilenler',
    'Tous modes': 'Tüm servis türleri', 'Toutes tables': 'Tüm masalar', '⬇️ CSV commandes': '⬇️ CSV siparişler', '⬇️ CSV articles': '⬇️ CSV ürünler',
    'Date': 'Tarih', 'Articles': 'Ürünler', 'Chargement…': 'Yükleniyor…', 'Aucune commande ne correspond.': 'Eşleşen sipariş yok.',

    // Produits
    'Toutes les catégories': 'Tüm kategoriler', 'Rechercher un produit…': 'Ürün ara…', '+ Nouveau produit': '+ Yeni ürün',
    '« Visible » = affiché sur la carte · « Disponible » = commandable (sinon « Épuisé ») · sans prix = visible mais non commandable.': '« Görünür » = menüde gösterilir · « Mevcut » = sipariş edilebilir (değilse « Tükendi ») · fiyatsız = görünür ama sipariş edilemez.',
    'Prix à saisir': 'Fiyat girilmeli', 'Visible': 'Görünür', 'Disponible': 'Mevcut', '✏️ Modifier': '✏️ Düzenle', 'Dupliquer': 'Kopyala',
    'Supprimer': 'Sil', '★ Signature': '★ İmza ürün', 'Aucun produit.': 'Ürün yok.',
    'Modifier le produit': 'Ürünü düzenle', 'Nouveau produit': 'Yeni ürün', 'Nom *': 'Ad *', 'Catégorie': 'Kategori',
    'Prix (€) — vide = prix à venir': 'Fiyat (€) — boş = fiyat sonra girilecek', 'ex. 4.50': 'örn. 4.50', 'Description': 'Açıklama',
    'Étiquettes (séparées par des virgules)': 'Etiketler (virgülle ayırın)', 'BIO, Sans caféine, Fait maison…': 'BIO, Kafeinsiz, Ev yapımı…',
    'Options & suppléments proposés': 'Sunulan seçenekler ve ekstralar',
    'Cliquez pour activer/désactiver. Gérez les choix et prix dans « Options & suppléments ».': 'Açmak/kapatmak için tıklayın. Seçenekleri ve fiyatları « Seçenekler ve ekstralar » bölümünden yönetin.',
    'Photo': 'Fotoğraf', '📷 Ajouter une photo': '📷 Fotoğraf ekle', '📷 Remplacer la photo': '📷 Fotoğrafı değiştir', 'Retirer la photo': 'Fotoğrafı kaldır',
    "Redimensionnée automatiquement. Sans photo, l'illustration ci-dessous est utilisée.": 'Otomatik olarak boyutlandırılır. Fotoğraf yoksa aşağıdaki çizim kullanılır.',
    'Illustration (sans photo)': 'Çizim (fotoğraf yokken)', 'Contenant': 'Kap', 'Couleur de la boisson': 'İçeceğin rengi',
    'Chaud': 'Sıcak', 'Froid': 'Soğuk', 'Chaud ou froid': 'Sıcak veya soğuk', 'Effet latte étagé': 'Katmanlı latte görünümü',
    'Visible sur la carte': 'Menüde görünür', '★ Signature (mise en avant)': '★ İmza ürün (öne çıkan)', 'Ordre': 'Sıra', 'Enregistrer': 'Kaydet',
    'Verre glacé (boissons froides)': 'Buzlu bardak (soğuk içecekler)', 'Limonade (verre + citron)': 'Limonata (bardak + limon)',
    'Tasse latte': 'Latte fincanı', 'Tasse espresso': 'Espresso fincanı', 'Tasse de café turc': 'Türk kahvesi fincanı',
    'Verre à thé tulipe': 'İnce belli çay bardağı', 'Cezve dans le sable': 'Kumda cezve', 'Café filtre V60': 'V60 filtre kahve',
    'Trio de mini verres': 'Üçlü mini bardak', 'Pâtisserie': 'Tatlı',

    // Catégories
    'Catégories de la carte': 'Menü kategorileri',
    "Une catégorie masquée cache tous ses produits côté client. Une catégorie vide n'apparaît pas.": 'Gizlenen bir kategori tüm ürünlerini müşteriden gizler. Boş kategori görünmez.',
    'Icône': 'Simge', 'Affichage': 'Görünüm', 'Masquée': 'Gizli', 'Ajouter une catégorie': 'Kategori ekle',
    'Ex. Brunch du week-end': 'Örn. Hafta sonu brunch', '+ Ajouter': '+ Ekle',

    // Options
    "Ce sont les choix proposés au client (carte officielle : lait végétal, sirop BIO, extra espresso, parfum du café turc, chaud/froid…). Le prix du supplément s'ajoute automatiquement.": 'Bunlar müşteriye sunulan seçeneklerdir (resmî menü: bitkisel süt, organik şurup, ekstra espresso, Türk kahvesi aroması, sıcak/soğuk…). Ekstra ücret otomatik olarak eklenir.',
    'Nom du groupe': 'Grup adı', 'Type': 'Tür', 'Un seul choix': 'Tek seçim', 'Plusieurs choix': 'Çoklu seçim', 'Obligatoire': 'Zorunlu',
    'Aide affichée au client': 'Müşteriye gösterilen açıklama', 'Choix': 'Seçenek', 'Supplément (€)': 'Ekstra ücret (€)', 'Dispo': 'Mevcut',
    'Nouveau choix (ex. Lait de coco)': 'Yeni seçenek (örn. Hindistan cevizi sütü)', '+ Choix': '+ Seçenek',
    'Utilisé par': 'Kullanım:', 'produit(s).': 'ürün.', 'Ajouter à toute la catégorie': 'Tüm kategoriye ekle',
    'Retirer de la catégorie': 'Kategoriden kaldır', 'Supprimer le groupe': 'Grubu sil', "Nouveau groupe d'options": 'Yeni seçenek grubu',
    'Ex. Taille, Sucre…': 'Örn. Boy, Şeker…', '+ Créer': '+ Oluştur',

    // Suggestions
    'Suggestions activées': 'Öneriler açık', 'Proposer juste après un ajout': 'Ürün eklendikten hemen sonra öner',
    'Nombre de suggestions': 'Öneri sayısı', 'Titre dans le panier': 'Sepetteki başlık',
    'Les produits déjà au panier, épuisés, masqués ou': 'Sepette olan, tükenmiş, gizlenmiş veya', 'sans prix': 'fiyatsız',
    "ne sont jamais proposés : saisissez le prix des pâtisseries pour qu'elles apparaissent.": 'ürünler asla önerilmez: tatlıların görünmesi için fiyatlarını girin.',
    '👀 Aperçu': '👀 Önizleme', 'Si le client a dans son panier :': 'Müşterinin sepetinde şu varsa:',
    'Aucune suggestion pour ce panier.': 'Bu sepet için öneri yok.', 'Règles': 'Kurallar', 'Active': 'Aktif', 'Actif': 'Aktif',
    'Message affiché au client': 'Müşteriye gösterilen mesaj',
    'Si le panier contient un produit de ces catégories…': 'Sepette bu kategorilerden bir ürün varsa…',
    "… ou l'un de ces produits": '… veya bu ürünlerden biri', '… alors proposer (dans cet ordre)': '… şunları öner (bu sırayla)',
    '+ Ajouter un produit déclencheur…': '+ Tetikleyici ürün ekle…', '+ Ajouter un produit à proposer…': '+ Önerilecek ürün ekle…',
    '+ Nouvelle règle': '+ Yeni kural', 'Suggestions par défaut': 'Varsayılan öneriler',
    'Complètent la liste quand les règles ne suffisent pas.': 'Kurallar yetmediğinde listeyi tamamlar.', '+ Ajouter…': '+ Ekle…',
    'Monter': 'Yukarı taşı', 'Retirer': 'Kaldır',
    'Ignoré tant que le produit est sans prix, masqué ou épuisé': 'Ürün fiyatsız, gizli veya tükenmişse dikkate alınmaz',

    // Tables & QR
    'Comment ça marche': 'Nasıl çalışır?',
    "Chaque table a son QR code. Le client le scanne : la carte s'ouvre avec": 'Her masanın kendi QR kodu var. Müşteri kodu okutunca menü',
    'sa table identifiée': 'masası tanınmış olarak',
    ', la commande arrive ici avec le numéro de table. Imprimez les cartes et posez-les sur les tables.': 'açılır; sipariş masa numarasıyla buraya gelir. Kartları yazdırıp masalara koyun.',
    'Adresse du site (modifiable si vous prenez un nom de domaine)': 'Site adresi (alan adı alırsanız değiştirebilirsiniz)',
    "Inclure l'illustration Büşra & Fatih": 'Büşra & Fatih çizimini ekle', "Enregistrer l'adresse": 'Adresi kaydet',
    '🖨️ Imprimer tous les QR (4 par page A4)': '🖨️ Tüm QR kodlarını yazdır (A4 sayfaya 4 adet)',
    '⬇️ QR général (vitrine / à emporter)': '⬇️ Genel QR (vitrin / paket)', 'Code dans le lien du QR': 'QR bağlantısındaki kod',
    'Zone': 'Bölge', 'Tester ↗': 'Dene ↗', 'Ajouter une table': 'Masa ekle', 'Code': 'Kod', 'Nom affiché': 'Görünen ad',
    'QR indisponible': 'QR kullanılamıyor',

    // Offres
    '🎓 Réduction étudiante': '🎓 Öğrenci indirimi',
    'Affichée en boutique : « −10 % pour tous les étudiants ». Le client la coche à la validation ; vérifiez la carte au comptoir (rappel sur la commande).': 'Dükkânda yazan: « Tüm öğrencilere %10 indirim ». Müşteri siparişi onaylarken işaretler; kartı tezgâhta kontrol edin (siparişte hatırlatma çıkar).',
    'Activée': 'Açık', 'Réduction (%)': 'İndirim (%)', 'Mention': 'Açıklama', '🎁 Fidélité (comme MYKONOS)': '🎁 Sadakat programı',
    'Après la 1ʳᵉ commande, le client crée son compte : réduction utilisable une fois, après le délai.': 'İlk siparişten sonra müşteri hesap oluşturur: indirim, bekleme süresinden sonra bir kez kullanılabilir.',
    'Délai avant activation (heures)': 'Aktifleşme süresi (saat)', 'Enregistrer les offres': 'Kampanyaları kaydet', '🏷️ Codes promo': '🏷️ İndirim kodları',
    'Saisis par le client à la validation. Une seule réduction par commande (étudiant, fidélité ou code).': 'Müşteri siparişi onaylarken girer. Sipariş başına tek indirim (öğrenci, sadakat veya kod).',
    'Valeur': 'Değer', 'Minimum €': 'Minimum €', 'Expire le': 'Son geçerlilik', 'Utilisations': 'Kullanım', 'Aucun code.': 'Kod yok.', 'CODE': 'KOD',

    // Clients & newsletter
    'Rechercher un client…': 'Müşteri ara…', '⬇️ Export CSV': '⬇️ CSV dışa aktar', 'Cmd': 'Sip.', 'News.': 'Bülten', 'Fidélité': 'Sadakat',
    'Inscrit le': 'Kayıt tarihi', 'Contact': 'İletişim', 'Aucun client inscrit pour le moment.': 'Henüz kayıtlı müşteri yok.',
    'Réactiver': 'Yeniden etkinleştir', 'Suppr.': 'Sil', 'Utilisée': 'Kullanıldı', 'en attente': 'beklemede', '📧 Oui': '📧 Evet',
    'Abonnés newsletter': 'Bülten aboneleri', '⬇️ Exporter (CSV)': '⬇️ Dışa aktar (CSV)', 'E-mail': 'E-posta',
    'Désinscrit': 'Abonelikten çıktı', 'Aucun abonné.': 'Abone yok.', 'Ajouter un e-mail': 'E-posta ekle',

    // Comptabilité & tickets
    'Taux de TVA :': 'KDV oranı:', 'CA TTC (net des remboursements)': 'Ciro, KDV dahil (iadeler düşülmüş)', 'CA HT': 'Ciro (KDV hariç)',
    'Commandes valides': 'Geçerli siparişler', 'Encaissé net sur la période': 'Dönemde net tahsilat', 'Remises accordées': 'Yapılan indirimler',
    'Annulations (exclues du CA)': 'İptaller (ciroya dahil değil)', 'Remboursements effectués': 'Yapılan iadeler',
    'Moyen de paiement': 'Ödeme yöntemi', 'Paiements': 'Ödemeler', 'Encaissé': 'Tahsil edilen',
    'Aucun encaissement sur la période.': 'Bu dönemde tahsilat yok.',
    'Encaissements datés du jour du paiement ; remboursements datés du jour du remboursement.': 'Tahsilatlar ödeme gününe, iadeler iade gününe göre tarihlenir.',
    'CA TTC par jour': 'Günlük ciro (KDV dahil)', 'CA TTC par mois': 'Aylık ciro (KDV dahil)', 'Aucune vente sur cette période.': 'Bu dönemde satış yok.',
    'Par mode de service': 'Servis türüne göre', 'Meilleures ventes (avant remises)': 'En çok satanlar (indirim öncesi)',
    'Chargement des données…': 'Veriler yükleniyor…', 'Tickets': 'Fişler', 'Total HT': 'Toplam (KDV hariç)', 'Total TTC net': 'Net toplam (KDV dahil)',
    'Commandes non annulées, montants nets des remboursements.': 'İptal edilmeyen siparişler, iadeler düşülmüş tutarlar.',
    '⬇️ Journal PDF': '⬇️ Satış defteri (PDF)', 'HT': 'KDV hariç', 'TVA': 'KDV', 'TTC': 'KDV dahil', 'Aucun ticket sur cette période.': 'Bu dönemde fiş yok.',

    // Contenus
    '📣 Annonce & bandeau': '📣 Duyuru ve kayan yazı', 'Annonce en haut du site (vide = masquée)': 'Sitenin üstündeki duyuru (boş = gizli)',
    'Ex. Nouveau : Pumpkin Spice Latte !': 'Örn. Yeni: Pumpkin Spice Latte!', 'Bandeau défilant (une phrase par ligne)': 'Kayan yazı (her satıra bir cümle)',
    '🏠 Accueil': '🏠 Ana sayfa', 'Accroche': 'Üst başlık', 'Titre': 'Başlık', 'Texte': 'Metin',
    "Titre de l'affiche (cartouche)": 'Afiş başlığı', "Sous-titre de l'affiche": 'Afiş alt başlığı', "Image de l'affiche": 'Afiş görseli',
    'Affiche Büşra & Fatih (par défaut)': 'Büşra & Fatih afişi (varsayılan)', 'Image personnalisée': 'Özel görsel', '📷 Remplacer': '📷 Değiştir',
    "Revenir à l'affiche": 'Afişe geri dön', 'Promesses (4 lignes)': 'Vaatler (4 satır)', '☕ Café turc sur sable': '☕ Kumda Türk kahvesi',
    'Étapes (une par ligne)': 'Adımlar (her satıra bir)', '💚 Histoire & ateliers': '💚 Hikâye ve atölyeler', 'Prénoms affichés': 'Gösterilen isimler',
    "Titre de l'histoire": 'Hikâye başlığı', 'Histoire': 'Hikâye', 'Titre ateliers': 'Atölyeler başlığı', 'Texte ateliers': 'Atölyeler metni',
    'Message de fin de commande': 'Sipariş sonu mesajı', '💾 Enregistrer les contenus': '💾 İçerikleri kaydet',

    // Réglages
    '🏪 Établissement': '🏪 İşletme', 'Signature': 'İmza (alt başlık)', 'Slogan': 'Slogan', 'Téléphone': 'Telefon',
    'E-mail de contact': 'İletişim e-postası', 'Adresse': 'Adres', 'Instagram (sans @)': 'Instagram (@ olmadan)',
    'Lien Google Maps': 'Google Haritalar bağlantısı', '🕒 Horaires': '🕒 Çalışma saatleri', 'Jour': 'Gün', 'Ouverture': 'Açılış',
    'Fermeture': 'Kapanış', 'Fermé': 'Kapalı', '🧾 Prise de commande': '🧾 Sipariş alma',
    '⏸️ Mettre les commandes en ligne en pause': '⏸️ Online siparişleri duraklat', 'Commandes seulement pendant les horaires': 'Sadece çalışma saatlerinde sipariş',
    'Modes proposés (séparés par une virgule)': 'Sunulan servis türleri (virgülle ayırın, Fransızca yazın)',
    'Frais de livraison (€, si « Livraison »)': 'Teslimat ücreti (€, « Livraison » varsa)',
    'Modes possibles : Sur place, À emporter, Livraison.': 'Olası değerler: Sur place (kafede), À emporter (paket), Livraison (teslimat). Müşteri sitesinde Fransızca görünür.',
    "🔐 Code d'accès": '🔐 Erişim kodu',
    'Le code est stocké sous forme chiffrée (empreinte SHA-256). Préférez 6 caractères ou plus.': 'Kod şifreli olarak saklanır (SHA-256 özeti). 6 veya daha fazla karakter tercih edin.',
    'Code actuel': 'Mevcut kod', 'Nouveau code': 'Yeni kod', 'Changer le code': 'Kodu değiştir', '💳 Paiement': '💳 Ödeme',
    'Paiement sur place (comptoir / à table) actif. Les paiements en ligne (CB, Apple Pay, Google Pay) apparaissent « Bientôt » côté client : ils nécessitent un compte Stripe': 'Yerinde ödeme (tezgâhta / masada) aktif. Online ödemeler (kart, Apple Pay, Google Pay) müşteri tarafında « Yakında » olarak görünür: bunun için bir Stripe hesabı',
    'et': 've',
    "un petit serveur de paiement sécurisé. Aucune commande n'est marquée payée sans encaissement réel.": 'güvenli küçük bir ödeme sunucusu gerekir. Gerçek tahsilat olmadan hiçbir sipariş ödendi olarak işaretlenmez.',
    'TVA applicable (%)': 'Uygulanan KDV (%)', '📧 E-mails automatiques (EmailJS)': '📧 Otomatik e-postalar (EmailJS)',
    'Envoyer les e-mails de confirmation': 'Onay e-postalarını gönder', 'Clé publique': 'Genel anahtar', 'Modèle client': 'Müşteri şablonu',
    'Modèle gérant': 'Yönetici şablonu', 'E-mail qui reçoit les commandes': 'Siparişleri alan e-posta', '✉️ Envoyer un e-mail de test': '✉️ Test e-postası gönder',
    '💾 Enregistrer les réglages': '💾 Ayarları kaydet', '💾 Données & sauvegarde': '💾 Veriler ve yedekleme',
    "Exportez régulièrement une sauvegarde (carte, réglages, contenus). L'export complet inclut aussi les commandes en cache, clients et newsletter.": 'Düzenli olarak yedek alın (menü, ayarlar, içerikler). Tam dışa aktarma önbellekteki siparişleri, müşterileri ve bülteni de içerir.',
    '⬇️ Sauvegarde de la carte': '⬇️ Menü yedeği', '⬇️ Export complet': '⬇️ Tam dışa aktarma', '⬆️ Importer une carte': '⬆️ Menü içe aktar',
    '♻️ Réinitialiser la carte officielle': '♻️ Resmî menüye sıfırla',

    // Messages (toasts)
    'Alerte sonore activée 🔔': 'Sesli uyarı açıldı 🔔', 'Alerte sonore coupée 🔕': 'Sesli uyarı kapatıldı 🔕',
    'Autorisez les fenêtres pop-up pour imprimer': 'Yazdırmak için açılır pencerelere izin verin', 'Encaissement annulé': 'Tahsilat geri alındı',
    'Commande supprimée': 'Sipariş silindi', 'Mis à jour ✓': 'Güncellendi ✓', 'Produit dupliqué': 'Ürün kopyalandı', 'Produit supprimé': 'Ürün silindi',
    'Image trop lourde (max 12 Mo)': 'Görsel çok büyük (en fazla 12 MB)', 'Image illisible': 'Görsel okunamadı', 'Photo prête (aperçu)': 'Fotoğraf hazır (önizleme)',
    'Nom requis': 'Ad gerekli', 'Prix invalide': 'Geçersiz fiyat', 'Produit enregistré ✓ — visible côté client': 'Ürün kaydedildi ✓ — müşteri tarafında görünür',
    'Produit ajouté ✓': 'Ürün eklendi ✓', 'Catégorie mise à jour': 'Kategori güncellendi', 'Catégorie ajoutée': 'Kategori eklendi',
    'Nom du choix requis': 'Seçenek adı gerekli', 'QR téléchargé ✓': 'QR indirildi ✓', 'Adresse enregistrée': 'Adres kaydedildi',
    'Code et nom requis': 'Kod ve ad gerekli', 'Ce code de table existe déjà': 'Bu masa kodu zaten var', 'Table ajoutée': 'Masa eklendi',
    'Offres enregistrées ✓': 'Kampanyalar kaydedildi ✓', 'Code requis': 'Kod gerekli', 'Ce code existe déjà': 'Bu kod zaten var', 'Code ajouté': 'Kod eklendi',
    'Réduction réactivée': 'İndirim yeniden etkinleştirildi', 'E-mail invalide': 'Geçersiz e-posta', 'Abonné ajouté': 'Abone eklendi',
    'TVA mise à jour': 'KDV güncellendi', 'Librairie PDF indisponible': 'PDF kütüphanesi kullanılamıyor',
    'Contenus enregistrés ✓ — visibles sur le site': 'İçerikler kaydedildi ✓ — sitede görünür', "Image d'accueil remplacée": 'Ana sayfa görseli değiştirildi',
    'Réglages enregistrés ✓': 'Ayarlar kaydedildi ✓', 'Code actuel incorrect': 'Mevcut kod yanlış',
    'Le nouveau code doit faire au moins 4 caractères': 'Yeni kod en az 4 karakter olmalı', "Code d'accès changé ✓": 'Erişim kodu değiştirildi ✓',
    'Librairie e-mail non chargée': 'E-posta kütüphanesi yüklenmedi', 'E-mail de test envoyé ✓': 'Test e-postası gönderildi ✓',
    'Erreur EmailJS': 'EmailJS hatası', 'Carte importée ✓': 'Menü içe aktarıldı ✓', 'Fichier invalide': 'Geçersiz dosya', 'Carte réinitialisée': 'Menü sıfırlandı',
    '⚠️ Synchronisation refusée par la base : vérifiez les règles Firebase': '⚠️ Veritabanı senkronizasyonu reddetti: Firebase kurallarını kontrol edin',
    "Renseignez d'abord la clé, le service et le template admin, puis Enregistrez.": 'Önce anahtarı, servisi ve yönetici şablonunu girip kaydedin.',
    '☕ Nouvelle commande Mozaïk': '☕ Yeni Mozaïk siparişi',

    // Confirmations
    'Supprimer cette catégorie ?': 'Bu kategori silinsin mi?',
    "Supprimer ce groupe d'options (il sera retiré de tous les produits) ?": 'Bu seçenek grubu silinsin mi? (Tüm ürünlerden kaldırılacak.)',
    'Supprimer cette règle ?': 'Bu kural silinsin mi?', 'Supprimer ce code ?': 'Bu kod silinsin mi?', 'Supprimer ce client ?': 'Bu müşteri silinsin mi?',
    'Supprimer cet abonné ?': 'Bu abone silinsin mi?', 'Importer cette carte ? La carte actuelle sera remplacée.': 'Bu menü içe aktarılsın mı? Mevcut menünün yerini alacak.',
    'Revenir à la carte officielle par défaut ? Vos modifications de produits, options, contenus et réglages seront perdues (commandes et clients conservés).': 'Varsayılan resmî menüye dönülsün mü? Ürün, seçenek, içerik ve ayar değişiklikleriniz silinir (siparişler ve müşteriler korunur).',

    // Bon de préparation imprimé
    'Note :': 'Not:', 'À ENCAISSER': 'TAHSİL EDİLECEK', 'client@email.fr': 'musteri@eposta.com'
  };

  var DAY_SHORT = { lun: 'Pzt', mar: 'Sal', mer: 'Çar', jeu: 'Per', ven: 'Cum', sam: 'Cmt', dim: 'Paz' };
  var DAY_ABBR = { Lun: 'Pzt', Mar: 'Sal', Mer: 'Çar', Jeu: 'Per', Ven: 'Cum', Sam: 'Cmt', Dim: 'Paz' };

  function trPeriod(s) {
    if (EXACT[s]) return EXACT[s];
    var m;
    if ((m = s.match(/^Année (\d{4})$/))) return m[1] + ' yılı';
    if ((m = s.match(/^(\S+) (\d{4})$/)) && EXACT[m[1]]) return EXACT[m[1]] + ' ' + m[2];
    if ((m = s.match(/^du (.+) au (.+)$/))) return m[1] + ' – ' + m[2];
    return s;
  }
  function trHours(s) {
    return s.replace(/Fermé le (\w+)/g, function (_, d) { var D = d.charAt(0).toUpperCase() + d.slice(1); return (EXACT[D] || D) + ' kapalı'; })
      .replace(/\b(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)\b/g, function (d) { return DAY_ABBR[d]; }).replace(/ fermé/g, ' kapalı');
  }
  function trStatus(s) { return EXACT[s] || s; }

  /* ---------------- Textes avec valeurs (motifs) ---------------- */
  var PATTERNS = [
    [/^Reste à encaisser \((\d+)\)$/, 'Tahsil edilecek ($1)'],
    [/^(\d+) produit\(s\) sans prix$/, '$1 fiyatsız ürün'],
    [/^— visibles mais non commandables : (.*)\.$/, '— görünüyor ama sipariş edilemiyor: $1.'],
    [/^(\d+) produit\(s\) affichés avec une illustration : ajoutez vos vraies photos \(Produits → Modifier → Photo\)\.$/, '$1 ürün çizimle gösteriliyor: gerçek fotoğraflarınızı ekleyin (Ürünler → Düzenle → Fotoğraf).'],
    [/^Commandes en cours \((\d+)\)$/, 'Aktif siparişler ($1)'],
    [/^Encaisser #(\S+)$/, '#$1 tahsil et'],
    [/^Rembourser #(\S+)$/, '#$1 iade et'],
    [/^Annuler #(\S+) \?$/, '#$1 iptal edilsin mi?'],
    [/^Commande #(\S+)$/, 'Sipariş #$1'],
    [/^Rembourser (.+) \((.+)\)$/, function (_, a, b) { return a + ' iade et (' + (EXACT[b] || b) + ')'; }],
    [/^Payée (.+) \((.+)\) · déjà remboursé (.+)$/, function (_, a, b, c) { return a + ' ödendi (' + (EXACT[b] || b) + ') · daha önce iade edilen: ' + c; }],
    [/^(\d\d\/\d\d\/\d{4} \d\d:\d\d) · QR code de table$/, '$1 · Masa QR kodu'],
    [/^Motif d'annulation : (.*)$/, 'İptal nedeni: $1'],
    [/^✓ Payée · (.*)$/, function (_, a) { return '✓ Ödendi · ' + (EXACT[a] || a); }],
    [/^↩︎ Remb\. (.*)$/, '↩︎ İade $1'],
    [/^(\d+) commande\(s\) · (\d+) valide\(s\) ·$/, '$1 sipariş · $2 geçerli ·'],
    [/^net · (\d+) annulée\(s\)$/, 'net · $1 iptal'],
    [/^(\d+) art\.$/, '$1 ürün'],
    [/^Options : (.*)$/, 'Seçenekler: $1'],
    [/^(.*) \(masquée\)$/, '$1 (gizli)'],
    [/^(.*) \(sans prix\)$/, '$1 (fiyatsız)'],
    [/^(.*) \(sans prix\) \[masqué\]$/, '$1 (fiyatsız) [gizli]'],
    [/^(.*) \[masqué\]$/, '$1 [gizli]'],
    [/^Comptes clients \((\d+)\)$/, 'Müşteri hesapları ($1)'],
    [/^−(\d+(?:[.,]\d+)?) % dispo$/, '−%$1 kullanılabilir'],
    [/^le (\d\d\/\d\d\/\d{4})$/, '$1'],
    [/^(\d+) abonné\(s\) actif\(s\) sur (\d+) — idéal pour annoncer ateliers et nouveautés\.$/, '$2 aboneden $1 aktif — atölyeleri ve yenilikleri duyurmak için ideal.'],
    [/^TVA collectée \((.+) %\)$/, 'Tahsil edilen KDV (%$1)'],
    [/^TVA \((.+) %\)$/, 'KDV (%$1)'],
    [/^💳 Répartition des encaissements — (.*)$/, function (_, p) { return '💳 Ödeme yöntemine göre tahsilat — ' + trPeriod(p); }],
    [/^Tickets — (.*)$/, function (_, p) { return 'Fişler — ' + trPeriod(p); }],
    [/^Affiché sur le site \(« Ouvert \/ Fermé » en direct\) : (.*)$/, function (_, h) { return 'Sitede canlı « Açık / Kapalı » olarak gösterilir: ' + trHours(h); }],
    [/^Même compte EmailJS que MYKONOS : les modèles reçoivent \{\{restaurant_name\}\} = (.*)\.$/, 'MYKONOS ile aynı EmailJS hesabı: şablonlara {{restaurant_name}} = $1 gönderilir.'],
    [/^Trop d'essais\. Réessayez dans (\d+) s\.$/, 'Çok fazla deneme. $1 sn sonra tekrar deneyin.'],
    [/^🔔 (\d+) nouvelle\(s\) commande\(s\) !$/, '🔔 $1 yeni sipariş!'],
    [/^#(\S+) encaissée ✓$/, '#$1 tahsil edildi ✓'],
    [/^Montant invalide \(max (.*)\)$/, 'Geçersiz tutar (en fazla $1)'],
    [/^Remboursement de (.*) enregistré$/, '$1 iade kaydedildi'],
    [/^#(\S+) annulée$/, '#$1 iptal edildi'],
    [/^Statut : (.*)$/, function (_, s) { return 'Durum: ' + trStatus(s); }],
    [/^#(\S+) → (.*)$/, function (_, n, s) { return '#' + n + ' → ' + trStatus(s); }],
    [/^Déplacez ou supprimez d'abord les (\d+) produit\(s\) de cette catégorie$/, 'Önce bu kategorideki $1 ürünü taşıyın veya silin'],
    [/^(\d+) produit\(s\) mis à jour$/, '$1 ürün güncellendi'],
    [/^Échec : (.*)$/, function (_, e) { return 'Hata: ' + (e === 'vérifiez les identifiants' ? 'kimlik bilgilerini kontrol edin' : e); }],
    [/^TVA mise à jour \((.*)\)$/, 'KDV güncellendi ($1)'],
    [/^Supprimer définitivement la commande #(\S+) \?\nPréférez « Annuler » pour garder une trace comptable\.$/, '#$1 numaralı sipariş kalıcı olarak silinsin mi?\nMuhasebe kaydı için « İptal et » seçeneğini tercih edin.'],
    [/^Supprimer « (.*) » \? \(vous pouvez aussi le masquer\)$/, '« $1 » silinsin mi? (İsterseniz sadece gizleyebilirsiniz.)'],
    [/^Supprimer (.*) \? Son QR code ne fonctionnera plus\.$/, '$1 silinsin mi? QR kodu artık çalışmayacak.'],
    [/^Client : (.*)$/, 'Müşteri: $1'],
    [/^TOTAL : (.*)$/, 'TOPLAM: $1'],
    [/^Payée \((.*)\)$/, function (_, a) { return 'Ödendi (' + (EXACT[a] || a) + ')'; }],
    [/^(lun|mar|mer|jeu|ven|sam|dim)\. (\d\d\/\d\d)(.*)$/, function (_, d, dt, rest) { return DAY_SHORT[d] + ' ' + dt + rest.replace(/ · (\d+) cmd/g, ' · $1 sipariş'); }]
  ];

  /* ---------------- Fragments dans des textes mixtes ---------------- */
  var PHRASES = [
    [/il y a (\d+) h (\d+) min/g, '$1 sa $2 dk önce'],
    [/il y a (\d+) h\b/g, '$1 sa önce'],
    [/il y a (\d+) min/g, '$1 dk önce'],
    [/à l'instant/g, 'az önce'],
    [/ · (\d+) cmd\b/g, ' · $1 sipariş'],
    [/🎓 vérifier la carte étudiante/g, '🎓 öğrenci kartını kontrol edin'],
    [/Étudiant −(\d+(?:[.,]\d+)?) %/g, 'Öğrenci −%$1'],
    [/Fidélité −(\d+(?:[.,]\d+)?) %/g, 'Sadakat −%$1'],
    [/\bCode ([A-Z0-9_-]+)/g, 'Kod $1'],
    [/Carte bancaire \(TPE\)/g, 'Banka kartı (POS)'],
    [/Titre-restaurant/g, 'Yemek çeki'],
    [/Espèces/g, 'Nakit'],
    [/Paiement sur place/g, 'Yerinde ödeme'],
    [/^Sur place\b/g, 'Kafede'],
    [/^À emporter\b/g, 'Paket'],
    [/^Livraison\b/g, 'Teslimat']
  ];

  function trCore(c) {
    if (Object.prototype.hasOwnProperty.call(EXACT, c)) return EXACT[c];
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i], m = c.match(p[0]);
      if (m) return typeof p[1] === 'function' ? p[1].apply(null, m) : c.replace(p[0], p[1]);
    }
    var o = c;
    for (var j = 0; j < PHRASES.length; j++) o = o.replace(PHRASES[j][0], PHRASES[j][1]);
    return o;
  }
  function t(s) {
    if (lang !== 'tr' || s == null) return s;
    s = String(s);
    var m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
    if (!core) return s;
    var out = trCore(core);
    return out === core ? s : m[1] + out + m[3];
  }

  /* ---------------- Application au DOM ---------------- */
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  function skipped(elm) { return !elm || SKIP[elm.tagName] || (elm.closest && elm.closest('[data-notr]')); }
  function doText(node) {
    if (skipped(node.parentElement)) return;
    var v = node.nodeValue, nv = t(v);
    if (nv !== v) node.nodeValue = nv;
  }
  function doAttrs(elm) {
    if (skipped(elm)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = elm.getAttribute && elm.getAttribute(ATTRS[i]);
      if (v) { var nv = t(v); if (nv !== v) elm.setAttribute(ATTRS[i], nv); }
    }
  }
  function apply(root) {
    if (lang !== 'tr' || !root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var base = root.nodeType === 9 ? root.documentElement : root;
    doAttrs(base);
    var w = (root.ownerDocument || root).createTreeWalker(base, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  function setLang(l) {
    try { localStorage.setItem(KEY, l === 'tr' ? 'tr' : 'fr'); } catch (e) {}
    location.reload();
  }
  function bindButtons() {
    ['admLang', 'admLangLogin'].forEach(function (id) {
      var b = document.getElementById(id); if (!b) return;
      b.textContent = lang === 'tr' ? '🇫🇷 Français' : '🇹🇷 Türkçe';
      b.setAttribute('title', lang === 'tr' ? 'Arayüzü Fransızcaya çevir' : 'Traduire l\'interface en turc');
      b.addEventListener('click', function () { setLang(lang === 'tr' ? 'fr' : 'tr'); });
    });
  }

  if (lang === 'tr') {
    document.documentElement.lang = 'tr';
    var nativeConfirm = global.confirm, nativeAlert = global.alert;
    global.confirm = function (msg) { return nativeConfirm.call(global, t(msg)); };
    global.alert = function (msg) { return nativeAlert.call(global, t(msg)); };
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) apply(m.addedNodes[j]);
      }
    });
    var start = function () {
      apply(document);
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindButtons); else bindButtons();

  global.MOZAIK_I18N = { lang: lang, t: t, apply: apply, setLang: setLang };
})(window);
