/**
 * Themen-Cluster für Imposter-Hilfswörter (nur Wörter aus words.ts).
 */

export const HELPER_CLUSTERS: Record<string, string[][]> = {
  tiere: [
    ['Hund', 'Katze', 'Maus', 'Ratte', 'Hase', 'Igel', 'Eichhörnchen', 'Fledermaus'],
    ['Pferd', 'Kuh', 'Schwein', 'Huhn', 'Ente', 'Gans', 'Schaf', 'Ziege', 'Wildschwein'],
    ['Fuchs', 'Wolf', 'Bär', 'Reh', 'Hirsch'],
    ['Löwe', 'Tiger', 'Elefant', 'Giraffe', 'Affe', 'Zebra', 'Nashorn', 'Nilpferd', 'Kamel'],
    ['Pinguin', 'Delfin', 'Hai', 'Wal', 'Möwe'],
    ['Adler', 'Eule', 'Spatz', 'Storch', 'Papagei'],
    ['Biene', 'Ameise', 'Spinne', 'Schmetterling', 'Marienkäfer'],
    ['Frosch', 'Schildkröte', 'Schlange', 'Krokodil'],
  ],
  essen: [
    ['Brot', 'Brötchen', 'Brezel', 'Butter', 'Käse', 'Honig', 'Marmelade'],
    ['Apfel', 'Banane', 'Erdbeere', 'Kirsche', 'Weintraube', 'Zitrone'],
    ['Kartoffel', 'Möhre', 'Gurke', 'Tomate', 'Zwiebel', 'Knoblauch', 'Salat'],
    ['Pizza', 'Reis', 'Nudeln', 'Suppe', 'Pommes', 'Döner', 'Currywurst'],
    ['Braten', 'Schnitzel', 'Wurst', 'Schinken', 'Spiegelei', 'Pfannkuchen'],
    ['Kuchen', 'Torte', 'Keks', 'Schokolade', 'Speiseeis'],
    ['Milch', 'Joghurt', 'Müsli'],
    ['Kaffee', 'Tee', 'Kakao', 'Limonade', 'Apfelsaft', 'Mineralwasser', 'Bier', 'Wein', 'Sekt'],
  ],
  berufe: [
    ['Arzt', 'Krankenschwester', 'Lehrer', 'Erzieher', 'Polizist', 'Feuerwehrmann', 'Bäcker'],
    ['Metzger', 'Koch', 'Kellner', 'Friseur', 'Gärtner', 'Landwirt', 'Tierarzt'],
    ['Apotheker', 'Zahnarzt', 'Anwalt', 'Richter', 'Bankkaufmann', 'Verkäufer', 'Kassierer'],
    ['Postbote', 'Busfahrer', 'Lokführer', 'Pilot', 'Flugbegleiter', 'Kapitän', 'Elektriker'],
    ['Klempner', 'Maler', 'Maurer', 'Dachdecker', 'Schreiner', 'Mechaniker', 'Ingenieur'],
    ['Architekt', 'Programmierer', 'Journalist', 'Fotograf', 'Musiker', 'Schauspieler', 'Sänger'],
    ['Bibliothekar', 'Hausmeister', 'Reinigungskraft', 'Schornsteinfeger', 'Optiker', 'Physiotherapeut', 'Steuerberater', 'Soldat'],
  ],
  sport: [
    ['Fußball', 'Handball', 'Basketball', 'Volleyball', 'Tennis', 'Tischtennis', 'Badminton'],
    ['Golf', 'Hockey', 'Eishockey', 'Schwimmen', 'Tauchen', 'Rudern', 'Segeln'],
    ['Surfen', 'Klettern', 'Wandern', 'Joggen', 'Marathon', 'Radfahren', 'Mountainbike'],
    ['Reiten', 'Turnen', 'Leichtathletik', 'Weitsprung', 'Hochsprung', 'Speerwurf', 'Kugelstoßen'],
    ['Boxen', 'Judo', 'Karate', 'Ringen', 'Fechten', 'Skifahren', 'Snowboard'],
    ['Rodeln', 'Eiskunstlauf', 'Biathlon', 'Skispringen', 'Bogenschießen', 'Sportschießen', 'Kegeln'],
    ['Bowling', 'Dart', 'Billard', 'Yoga', 'Pilates', 'Krafttraining', 'Rennrad', 'Triathlon'],
  ],
  reisen: [
    ['Strand', 'Berg', 'Insel', 'Wüste', 'Dschungel', 'Hotel', 'Ferienwohnung'],
    ['Campingplatz', 'Zelt', 'Wohnwagen', 'Flughafen', 'Bahnhof', 'Hafen', 'Fähre'],
    ['Kreuzfahrt', 'Reisebüro', 'Koffer', 'Rucksack', 'Reisepass', 'Landkarte', 'Stadtführung'],
    ['Museum', 'Schloss', 'Burg', 'Leuchtturm', 'Wasserfall', 'Gletscher', 'Vulkan'],
    ['Nationalpark', 'Safari', 'Roadtrip', 'Backpacking', 'All-Inclusive', 'Städtereise', 'Wanderurlaub'],
    ['Skiurlaub', 'Badeurlaub', 'Camping', 'Jugendherberge', 'Hostel', 'Resort', 'Pension'],
    ['Souvenir', 'Postkarte', 'Reiseführer', 'Kompass', 'Fernglas', 'Sonnencreme', 'Badehose', 'Bikini'],
  ],
  technik: [
    ['Smartphone', 'Laptop', 'Tablet', 'Computer', 'Monitor', 'Tastatur', 'Maus'],
    ['Drucker', 'Scanner', 'Router', 'Modem', 'WLAN', 'Bluetooth', 'USB-Stick'],
    ['Festplatte', 'SSD', 'Prozessor', 'Grafikkarte', 'Motherboard', 'Netzteil', 'Lüfter'],
    ['Kopfhörer', 'Lautsprecher', 'Mikrofon', 'Webcam', 'Beamer', 'Fernseher', 'Smartwatch'],
    ['Drohne', 'Roboter', 'Server', 'Cloud', 'App', 'Browser', 'Passwort'],
    ['Akku', 'Ladegerät', 'Kabel', 'Adapter', 'Powerbank', 'Steckdose', 'Verlängerung'],
    ['Virtual Reality', 'Augmented Reality', 'Künstliche Intelligenz', 'Chatbot', 'Algorithmus', 'Datenbank', 'Firewall', 'Antivirus'],
  ],
  filme: [
    ['Kino', 'Popcorn', 'Ticket', 'Leinwand', 'Film', 'Serie', 'Staffel'],
    ['Regisseur', 'Schauspieler', 'Drehbuch', 'Kamera', 'Schnitt', 'Ton', 'Licht'],
    ['Action', 'Komödie', 'Horror', 'Drama', 'Thriller', 'Western', 'Science-Fiction'],
    ['Animation', 'Dokumentation', 'Musical', 'Krimi', 'Romantik', 'Fantasy', 'Abenteuer'],
    ['Oscar', 'Golden Globe', 'Berlinale', 'Cannes', 'Premiere', 'Trailer', 'Poster'],
    ['Netflix', 'Streaming', 'DVD', 'Blu-ray', 'Untertitel', 'Synchron', 'Originalton'],
    ['Blockbuster', 'Independent', 'Kurzfilm', 'Spielfilm', 'Dreh', 'Kulisse', 'Maske', 'Kostüm'],
  ],
  musik: [
    ['Gitarre', 'Klavier', 'Geige', 'Schlagzeug', 'Bass', 'Flöte', 'Saxophon'],
    ['Trompete', 'Posaune', 'Klarinette', 'Harfe', 'Cello', 'Bratsche', 'Oboe'],
    ['Gesang', 'Chor', 'Band', 'Orchester', 'Dirigent', 'Komponist', 'Sänger'],
    ['Konzert', 'Festival', 'Bühne', 'Mikrofon', 'Verstärker', 'Boxen', 'Mischpult'],
    ['Lied', 'Melodie', 'Rhythmus', 'Text', 'Refrain', 'Strophe', 'Song'],
    ['Pop', 'Rock', 'Jazz', 'Klassik', 'Hip-Hop', 'Techno', 'Folk'],
    ['Playlist', 'Album', 'Single', 'Radio', 'Streaming', 'CD', 'Schallplatte', 'Kopfhörer'],
  ],
  schule: [
    ['Lehrer', 'Schüler', 'Klasse', 'Schule', 'Unterricht', 'Pause', 'Stundenplan'],
    ['Heft', 'Stift', 'Tafel', 'Kreide', 'Ranzen', 'Federmappe', 'Lineal'],
    ['Mathe', 'Deutsch', 'Englisch', 'Biologie', 'Chemie', 'Physik', 'Geschichte'],
    ['Prüfung', 'Note', 'Zeugnis', 'Hausaufgabe', 'Referat', 'Klassenarbeit', 'Test'],
    ['Bibliothek', 'Sporthalle', 'Schulhof', 'Klassenfahrt', 'Elternabend', 'Direktor', 'Sekretärin'],
    ['Abitur', 'Mittlere Reife', 'Grundschule', 'Gymnasium', 'Realschule', 'Gesamtschule', 'Kindergarten'],
    ['Schultüte', 'Einschulung', 'Abschlussfeier', 'Zeugnisausgabe', 'Nachhilfe', 'Tutorium', 'AG', 'Vertretung'],
  ],
  haus: [
    ['Küche', 'Wohnzimmer', 'Schlafzimmer', 'Bad', 'Flur', 'Keller', 'Dachboden'],
    ['Bett', 'Sofa', 'Tisch', 'Stuhl', 'Schrank', 'Regal', 'Lampe'],
    ['Herd', 'Ofen', 'Spüle', 'Kühlschrank', 'Spülmaschine', 'Waschmaschine', 'Trockner'],
    ['Tür', 'Fenster', 'Wand', 'Decke', 'Boden', 'Treppe', 'Balkon'],
    ['Garten', 'Terrasse', 'Garage', 'Carport', 'Zaun', 'Rasen', 'Beet'],
    ['Schlüssel', 'Klingel', 'Briefkasten', 'Klingelschild', 'Haustür', 'Nebeneingang', 'Kellerabteil'],
    ['Heizung', 'Radiator', 'Thermostat', 'Steckdose', 'Lichtschalter', 'Vorhang', 'Teppich', 'Spiegel'],
  ],
  natur: [
    ['Regen', 'Schnee', 'Sonne', 'Wind', 'Sturm', 'Nebel', 'Hagel'],
    ['Wolke', 'Himmel', 'Blitz', 'Donner', 'Regenbogen', 'Mond', 'Stern'],
    ['Wald', 'Wiese', 'Berg', 'Tal', 'See', 'Fluss', 'Meer'],
    ['Baum', 'Blume', 'Gras', 'Moos', 'Pilz', 'Strauch', 'Blatt'],
    ['Stein', 'Sand', 'Fels', 'Höhle', 'Klippe', 'Strand', 'Düne'],
    ['Frühling', 'Sommer', 'Herbst', 'Winter', 'Tau', 'Frost', 'Hitze'],
    ['Vogel', 'Insekt', 'Tier', 'Pflanze', 'Wurzel', 'Samen', 'Frucht', 'Erde'],
  ],
  koerper: [
    ['Kopf', 'Auge', 'Ohr', 'Nase', 'Mund', 'Zahn', 'Zunge'],
    ['Hals', 'Schulter', 'Arm', 'Ellbogen', 'Hand', 'Finger', 'Daumen'],
    ['Brust', 'Bauch', 'Rücken', 'Hüfte', 'Bein', 'Knie', 'Fuß'],
    ['Herz', 'Lunge', 'Magen', 'Leber', 'Niere', 'Hirn', 'Haut'],
    ['Haar', 'Bart', 'Augenbraue', 'Wimper', 'Nagel', 'Knochen', 'Muskel'],
    ['Blut', 'Ader', 'Nerv', 'Gelenk', 'Sehne', 'Band', 'Knorpel'],
    ['Zeh', 'Ferse', 'Knöchel', 'Wade', 'Oberschenkel', 'Po', 'Taille', 'Nacken'],
  ],
  kleidung: [
    ['Hose', 'Jeans', 'Shorts', 'Rock', 'Kleid', 'Shirt', 'Pullover'],
    ['Jacke', 'Mantel', 'Weste', 'Hemd', 'Bluse', 'Pulli', 'Hoodie'],
    ['Schuhe', 'Stiefel', 'Sandalen', 'Turnschuhe', 'Socken', 'Strümpfe', 'Strumpfhose'],
    ['Hut', 'Mütze', 'Cap', 'Schal', 'Handschuhe', 'Gürtel', 'Hosenträger'],
    ['Unterwäsche', 'BH', 'Slip', 'Boxershorts', 'Schlafanzug', 'Bademantel', 'Pyjama'],
    ['Brille', 'Sonnenbrille', 'Uhr', 'Kette', 'Ring', 'Ohrring', 'Armband'],
    ['Krawatte', 'Fliege', 'Anzugsjacke', 'Kostüm', 'Tracht', 'Uniform', 'Overall', 'Schürze'],
  ],
  fahrzeuge: [
    ['Auto', 'Bus', 'Zug', 'Fahrrad', 'Motorrad', 'Roller', 'Lkw'],
    ['Taxi', 'U-Bahn', 'Straßenbahn', 'S-Bahn', 'Traktor', 'Bagger', 'Kran'],
    ['Flugzeug', 'Hubschrauber', 'Heißluftballon', 'Segelflugzeug', 'Drohne', 'Rakete', 'Raumschiff'],
    ['Schiff', 'Boot', 'Fähre', 'Yacht', 'Kanu', 'Kajak', 'Ruderboot'],
    ['Krankenwagen', 'Feuerwehr', 'Polizeiauto', 'Müllwagen', 'Postauto', 'Lieferwagen', 'Transporter'],
    ['E-Bike', 'E-Scooter', 'Segway', 'Skateboard', 'Rollstuhl', 'Kinderwagen', 'Tretroller'],
    ['Wohnmobil', 'Wohnwagen', 'Anhänger', 'Sattelzug', 'Gabelstapler', 'Lokomotive', 'Waggon', 'Gondel'],
  ],
  spiele: [
    ['Schach', 'Dame', 'Mühle', 'Memory', 'Puzzle', 'Domino', 'Mensch ärgere dich nicht'],
    ['Karten', 'Poker', 'Rommé', 'Skat', 'Uno', 'Mau-Mau', 'Blackjack'],
    ['Würfel', 'Monopoly', 'Siedler von Catan', 'Risiko', 'Activity', 'Tabu', 'Stadt Land Fluss'],
    ['Videospiel', 'Konsole', 'Controller', 'Joystick', 'PC-Spiel', 'Handy-Spiel', 'Online-Spiel'],
    ['Verstecken', 'Fangen', 'Seilspringen', 'Hüpfkästchen', 'Fang den Hut', 'Topfschlagen', 'Blinde Kuh'],
    ['Dart', 'Billard', 'Bowling', 'Kicker', 'Tischtennis', 'Badminton', 'Federball'],
    ['Lego', 'Playmobil', 'Puppe', 'Teddy', 'Ball', 'Frisbee', 'Drachensteigen', 'Murmel'],
  ],
  feiertage: [
    ['Weihnachten', 'Ostern', 'Silvester', 'Geburtstag', 'Halloween', 'Karneval', 'Pfingsten'],
    ['Advent', 'Nikolaus', 'Heiligabend', 'Neujahr', 'Dreikönig', 'Muttertag', 'Vatertag'],
    ['Hochzeit', 'Taufe', 'Konfirmation', 'Kommunion', 'Jugendweihe', 'Jubiläum', 'Abschlussfeier'],
    ['Geschenk', 'Torte', 'Kerze', 'Ballon', 'Feuerwerk', 'Konfetti', 'Partyhütchen'],
    ['Festessen', 'Buffet', 'Sekt', 'Grillen', 'Picknick', 'Brunch', 'Abendessen'],
    ['Musik', 'Tanz', 'Rede', 'Toast', 'Glückwunsch', 'Einladung', 'Grußkarte'],
    ['Baum', 'Kranz', 'Stern', 'Engel', 'Nikolausstiefel', 'Osterei', 'Hasen', 'Maske'],
  ],
  gefuehle: [
    ['Freude', 'Glück', 'Liebe', 'Stolz', 'Hoffnung', 'Zuversicht', 'Heiterkeit'],
    ['Traurigkeit', 'Kummer', 'Enttäuschung', 'Sehnsucht', 'Heimweh', 'Einsamkeit', 'Melancholie'],
    ['Wut', 'Ärger', 'Zorn', 'Frust', 'Neid', 'Eifersucht', 'Hass'],
    ['Angst', 'Panik', 'Sorge', 'Nervosität', 'Aufregung', 'Schreck', 'Furcht'],
    ['Scham', 'Schuld', 'Verlegenheit', 'Peinlichkeit', 'Reue', 'Mitgefühl', 'Mitleid'],
    ['Langeweile', 'Müdigkeit', 'Erschöpfung', 'Überdruss', 'Interesse', 'Neugier', 'Begeisterung'],
    ['Überraschung', 'Verwirrung', 'Zweifel', 'Misstrauen', 'Ruhe', 'Gelassenheit', 'Respekt', 'Bewunderung'],
  ],
  stadt: [
    ['Rathaus', 'Marktplatz', 'Kirche', 'Dom', 'Bushaltestelle', 'Fußgängerzone', 'Einkaufszentrum'],
    ['Supermarkt', 'Bäckerei', 'Metzgerei', 'Apotheke', 'Drogerie', 'Buchhandlung', 'Blumenladen'],
    ['Kiosk', 'Postfiliale', 'Bank', 'Geldautomat', 'Bibliothek', 'Schwimmbad', 'Sporthalle'],
    ['Stadion', 'Kino', 'Theater', 'Stadtmuseum', 'Zoo', 'Stadtpark', 'Spielplatz'],
    ['Friedhof', 'Krankenhaus', 'Feuerwache', 'Polizeirevier', 'Ampel', 'Zebrastreifen', 'Kreisverkehr'],
    ['Parkhaus', 'Baustelle', 'Straßenlaterne', 'Mülleimer', 'Parkbank', 'Brunnen', 'Denkmal'],
    ['Brücke', 'Tunnel', 'Stau', 'Radweg', 'Bürgersteig', 'Hochhaus', 'Fahrkartenautomat', 'Wochenmarkt'],
  ],
  maerchen: [
    ['Schneewittchen', 'Aschenputtel', 'Dornröschen', 'Rotkäppchen', 'Rapunzel', 'Hänsel und Gretel', 'Frau Holle'],
    ['Rumpelstilzchen', 'Der Froschkönig', 'Die Bremer Stadtmusikanten', 'Der gestiefelte Kater', 'Tischlein deck dich', 'Das tapfere Schneiderlein', 'Die Sterntaler'],
    ['Der Wolf und die sieben Geißlein', 'Peter Pan', 'Pinocchio', 'Alice im Wunderland', 'Der kleine Prinz', 'Robin Hood', 'König Artus'],
    ['Drache', 'Ritter', 'Prinzessin', 'Prinz', 'König', 'Königin', 'Hexe'],
    ['Zauberer', 'Fee', 'Elfe', 'Zwerg', 'Riese', 'Troll', 'Kobold'],
    ['Einhorn', 'Meerjungfrau', 'Vampir', 'Werwolf', 'Gespenst', 'Zauberstab', 'Zaubertrank'],
    ['Zauberspiegel', 'Märchenschloss', 'Verwunschener Wald', 'Goldene Kugel', 'Glasschuh', 'Spinnrad', 'Siebenmeilenstiefel', 'Wunschbrunnen'],
  ],
  beruehmt: [
    ['Albert Einstein', 'Isaac Newton', 'Marie Curie', 'Charles Darwin', 'Leonardo da Vinci', 'Michelangelo', 'Vincent van Gogh'],
    ['Pablo Picasso', 'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Johann Wolfgang von Goethe', 'Friedrich Schiller', 'Die Gebrüder Grimm'],
    ['William Shakespeare', 'Astrid Lindgren', 'Anne Frank', 'Martin Luther', 'Martin Luther King', 'Mahatma Gandhi', 'Nelson Mandela'],
    ['Mutter Teresa', 'Winston Churchill', 'Konrad Adenauer', 'Angela Merkel', 'Helmut Kohl', 'Christoph Kolumbus', 'Neil Armstrong'],
    ['Alexander von Humboldt', 'Karl der Große', 'Napoleon', 'Kleopatra', 'Julius Cäsar', 'Elvis Presley', 'Michael Jackson'],
    ['Die Beatles', 'Freddie Mercury', 'Marilyn Monroe', 'Charlie Chaplin', 'Walt Disney', 'Steve Jobs', 'Bill Gates'],
    ['Muhammad Ali', 'Pelé', 'Franz Beckenbauer', 'Michael Schumacher', 'Steffi Graf', 'Boris Becker', 'Dirk Nowitzki', 'Usain Bolt'],
  ],
}

const LOOKUP = new Map<string, string[]>()

for (const [categoryId, groups] of Object.entries(HELPER_CLUSTERS)) {
  for (const group of groups) {
    const normalized = group.map((w) => w.trim()).filter(Boolean)
    if (normalized.length < 2) continue
    for (const word of normalized) {
      const key = `${categoryId}|${word.toLowerCase()}`
      LOOKUP.set(
        key,
        normalized.filter((w) => w.toLowerCase() !== word.toLowerCase()),
      )
    }
  }
}

/** Cluster-Nachbarn im Pool, sonst restliche Kategorie (ohne Geheimwort). */
export function helperCandidates(
  secretWord: string,
  categoryId: string,
  pool: string[],
): string[] {
  const secretLower = secretWord.toLowerCase()
  const poolOthers = pool.filter((w) => w.toLowerCase() !== secretLower)
  if (poolOthers.length === 0) return []

  const related = LOOKUP.get(`${categoryId}|${secretLower}`)
  if (related && related.length > 0) {
    const inPool = related.filter((r) =>
      poolOthers.some((p) => p.toLowerCase() === r.toLowerCase()),
    )
    if (inPool.length > 0) return inPool
  }
  return poolOthers
}
