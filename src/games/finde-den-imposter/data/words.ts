import type { WordEntry } from '../types'

/**
 * Der eingebaute deutsche Wortschatz -- 50 Wörter je Kategorie, zusammen 1000
 * (02.09.2026 von 355 aufgestockt).
 *
 * Regeln für neue Wörter:
 *  - Alltagswörter, die am Tisch jeder kennt. Wer das Wort erklären muss,
 *    verdirbt die Runde.
 *  - Innerhalb einer Kategorie keine Dopplungen und möglichst keine
 *    Fast-Synonyme: Aus dem Wortschatz wird auch das Hilfswort der Imposter
 *    gezogen, und "Sofa" als Hilfswort zu "Couch" wäre geschenkt.
 *  - Über Kategorien hinweg dürfen Wörter doppelt vorkommen (Maus ist Tier
 *    und Technik) -- gezogen wird immer nur innerhalb einer Kategorie.
 *
 * Die Liste ist zugleich die Quelle für supabase/migrations/011b_imposter_words.sql
 * (Online-Spiel). Nach Änderungen `node scripts/build-imposter-words-sql.mjs`
 * laufen lassen -- tests/imposter-words.test.ts schlägt sonst fehl.
 */
const BY_CATEGORY: Record<string, string[]> = {
  tiere: [
    'Hund', 'Katze', 'Pferd', 'Kuh', 'Schwein', 'Huhn', 'Ente', 'Gans', 'Schaf', 'Ziege',
    'Hase', 'Fuchs', 'Wolf', 'Bär', 'Löwe', 'Tiger', 'Elefant', 'Giraffe', 'Affe', 'Pinguin',
    'Delfin', 'Hai', 'Wal', 'Adler', 'Eule', 'Spatz', 'Storch', 'Biene', 'Ameise', 'Spinne',
    'Schmetterling', 'Frosch', 'Schildkröte', 'Schlange', 'Krokodil', 'Igel', 'Eichhörnchen',
    'Maus', 'Ratte', 'Fledermaus', 'Reh', 'Hirsch', 'Wildschwein', 'Kamel', 'Zebra',
    'Nashorn', 'Nilpferd', 'Papagei', 'Möwe', 'Marienkäfer',
  ],
  essen: [
    'Pizza', 'Brot', 'Butter', 'Käse', 'Milch', 'Joghurt', 'Apfel', 'Banane', 'Erdbeere',
    'Kirsche', 'Weintraube', 'Zitrone', 'Kartoffel', 'Möhre', 'Gurke', 'Tomate', 'Zwiebel',
    'Knoblauch', 'Salat', 'Reis', 'Nudeln', 'Suppe', 'Braten', 'Schnitzel', 'Wurst',
    'Schinken', 'Spiegelei', 'Pfannkuchen', 'Kuchen', 'Torte', 'Keks', 'Schokolade',
    'Speiseeis', 'Honig', 'Marmelade', 'Müsli', 'Brötchen', 'Brezel', 'Pommes', 'Currywurst',
    'Döner', 'Kaffee', 'Tee', 'Kakao', 'Limonade', 'Apfelsaft', 'Mineralwasser', 'Bier',
    'Wein', 'Sekt',
  ],
  berufe: [
    'Arzt', 'Krankenschwester', 'Lehrer', 'Erzieher', 'Polizist', 'Feuerwehrmann', 'Bäcker',
    'Metzger', 'Koch', 'Kellner', 'Friseur', 'Gärtner', 'Landwirt', 'Tierarzt', 'Apotheker',
    'Zahnarzt', 'Anwalt', 'Richter', 'Bankkaufmann', 'Verkäufer', 'Kassierer', 'Postbote',
    'Busfahrer', 'Lokführer', 'Pilot', 'Flugbegleiter', 'Kapitän', 'Elektriker', 'Klempner',
    'Maler', 'Maurer', 'Dachdecker', 'Schreiner', 'Mechaniker', 'Ingenieur', 'Architekt',
    'Programmierer', 'Journalist', 'Fotograf', 'Musiker', 'Schauspieler', 'Sänger',
    'Bibliothekar', 'Hausmeister', 'Reinigungskraft', 'Schornsteinfeger', 'Optiker',
    'Physiotherapeut', 'Steuerberater', 'Soldat',
  ],
  sport: [
    'Fußball', 'Handball', 'Basketball', 'Volleyball', 'Tennis', 'Tischtennis', 'Badminton',
    'Golf', 'Hockey', 'Eishockey', 'Schwimmen', 'Tauchen', 'Rudern', 'Segeln', 'Surfen',
    'Klettern', 'Wandern', 'Joggen', 'Marathon', 'Radfahren', 'Mountainbike', 'Reiten',
    'Turnen', 'Leichtathletik', 'Weitsprung', 'Hochsprung', 'Speerwurf', 'Kugelstoßen',
    'Boxen', 'Judo', 'Karate', 'Ringen', 'Fechten', 'Skifahren', 'Snowboard', 'Rodeln',
    'Eiskunstlauf', 'Biathlon', 'Skispringen', 'Bogenschießen', 'Sportschießen', 'Kegeln',
    'Bowling', 'Dart', 'Billard', 'Yoga', 'Pilates', 'Krafttraining', 'Rennrad', 'Triathlon',
  ],
  reisen: [
    'Strand', 'Berg', 'Insel', 'Wüste', 'Dschungel', 'Hotel', 'Ferienwohnung', 'Campingplatz',
    'Zelt', 'Wohnwagen', 'Flughafen', 'Bahnhof', 'Hafen', 'Fähre', 'Kreuzfahrt', 'Reisebüro',
    'Koffer', 'Rucksack', 'Reisepass', 'Landkarte', 'Stadtführung', 'Museum', 'Schloss',
    'Burg', 'Leuchtturm', 'Wasserfall', 'Höhle', 'Bergsee', 'Fluss', 'Meer', 'Alpen',
    'Nordsee', 'Ostsee', 'Schwarzwald', 'Bodensee', 'Rom', 'Paris', 'London', 'Wien',
    'Amsterdam', 'Barcelona', 'Prag', 'Venedig', 'Mallorca', 'Türkei', 'Italien', 'Norwegen',
    'Kanada', 'Japan', 'Ägypten',
  ],
  technik: [
    'Handy', 'Tablet', 'Laptop', 'Computer', 'Monitor', 'Tastatur', 'Maus', 'Drucker',
    'Scanner', 'Router', 'WLAN', 'Bluetooth', 'USB-Stick', 'Festplatte', 'Kopfhörer',
    'Lautsprecher', 'Fernseher', 'Fernbedienung', 'Beamer', 'Kamera', 'Drohne', 'Smartwatch',
    'Ladekabel', 'Powerbank', 'Steckdose', 'Batterie', 'Solarzelle', 'Windrad', 'Roboter',
    'Sprachassistent', 'App', 'Passwort', 'E-Mail', 'Suchmaschine', 'Videoanruf', 'Streaming',
    'Update', 'Virenscanner', 'Taschenlampe', 'Mikrowelle', 'Waschmaschine', 'Staubsauger',
    'Kühlschrank', 'Spülmaschine', 'Bohrmaschine', 'Rasenmäher', 'Navigationsgerät',
    'Klimaanlage', 'Nähmaschine', 'Wärmepumpe',
  ],
  filme: [
    'Titanic', 'Avatar', 'Matrix', 'Gladiator', 'Rocky', 'Terminator', 'Jurassic Park',
    'Star Wars', 'Herr der Ringe', 'Harry Potter', 'Der Pate', 'Forrest Gump', 'Findet Nemo',
    'König der Löwen', 'Shrek', 'Die Eiskönigin', 'Minions', 'Toy Story', 'Ice Age',
    'Das Dschungelbuch', 'Tatort', 'Lindenstraße', 'Die Sendung mit der Maus', 'Tagesschau',
    'Big Bang Theory', 'Friends', 'Die Simpsons', 'Game of Thrones', 'Stranger Things',
    'Breaking Bad', 'Dark', 'Kinosaal', 'Popcorn', 'Filmmusik', 'Abspann', 'Regisseur',
    'Drehbuch', 'Trailer', 'Hauptrolle', 'Statist', 'Kostüm', 'Kulisse', 'Oscar',
    'Serienfinale', 'Fortsetzung', 'Zeichentrick', 'Dokumentation', 'Krimi', 'Western',
    'Filmpremiere',
  ],
  musik: [
    'Gitarre', 'E-Gitarre', 'Bass', 'Schlagzeug', 'Klavier', 'Flügel', 'Geige', 'Cello',
    'Kontrabass', 'Querflöte', 'Blockflöte', 'Klarinette', 'Saxofon', 'Trompete', 'Posaune',
    'Tuba', 'Waldhorn', 'Harfe', 'Akkordeon', 'Mundharmonika', 'Xylofon', 'Triangel',
    'Tamburin', 'Orgel', 'Keyboard', 'Mikrofon', 'Chor', 'Orchester', 'Band', 'Dirigent',
    'Konzert', 'Festival', 'Noten', 'Takt', 'Refrain', 'Strophe', 'Melodie', 'Rhythmus',
    'Schlager', 'Rock', 'Pop', 'Jazz', 'Klassik', 'Hip-Hop', 'Techno', 'Volksmusik',
    'Blaskapelle', 'Radio', 'Plattenspieler', 'Ohrwurm',
  ],
  schule: [
    'Tafel', 'Kreide', 'Whiteboard', 'Schulheft', 'Schulbuch', 'Federmappe', 'Bleistift',
    'Kugelschreiber', 'Radiergummi', 'Lineal', 'Zirkel', 'Geodreieck', 'Taschenrechner',
    'Schulranzen', 'Pausenbrot', 'Pausenhof', 'Schulklingel', 'Stundenplan', 'Hausaufgaben',
    'Klassenarbeit', 'Diktat', 'Zeugnis', 'Schulnote', 'Sitzenbleiben', 'Klassenfahrt',
    'Wandertag', 'Schulbus', 'Turnhalle', 'Sportunterricht', 'Mathematik', 'Deutsch',
    'Englisch', 'Französisch', 'Biologie', 'Chemie', 'Physik', 'Erdkunde', 'Geschichte',
    'Kunstunterricht', 'Musikunterricht', 'Religion', 'Werken', 'Lehrerzimmer', 'Sekretariat',
    'Schulleiter', 'Klassensprecher', 'Elternabend', 'Abitur', 'Sommerferien', 'Schulhof',
  ],
  haus: [
    'Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Küche', 'Badezimmer', 'Flur', 'Keller',
    'Dachboden', 'Garage', 'Balkon', 'Terrasse', 'Garten', 'Treppe', 'Fenster', 'Haustür',
    'Dach', 'Schornstein', 'Sofa', 'Sessel', 'Couchtisch', 'Esstisch', 'Stuhl', 'Bett',
    'Matratze', 'Kissen', 'Bettdecke', 'Kleiderschrank', 'Kommode', 'Regal', 'Bücherregal',
    'Teppich', 'Vorhang', 'Lampe', 'Kronleuchter', 'Spiegel', 'Bilderrahmen', 'Blumentopf',
    'Herd', 'Backofen', 'Spüle', 'Wasserhahn', 'Badewanne', 'Dusche', 'Waschbecken',
    'Heizung', 'Türklinke', 'Briefkasten', 'Zaun', 'Hecke', 'Gartenzwerg',
  ],
  natur: [
    'Sonne', 'Mond', 'Sterne', 'Wolke', 'Regen', 'Schnee', 'Hagel', 'Nebel', 'Wind', 'Sturm',
    'Gewitter', 'Blitz', 'Donner', 'Regenbogen', 'Frost', 'Raureif', 'Morgentau', 'Hitze',
    'Dürre', 'Überschwemmung', 'Lawine', 'Erdbeben', 'Vulkan', 'Gletscher', 'Wald', 'Wiese',
    'Feld', 'Moor', 'Sumpf', 'Baum', 'Eiche', 'Buche', 'Tanne', 'Birke', 'Blume', 'Rose',
    'Tulpe', 'Sonnenblume', 'Gänseblümchen', 'Löwenzahn', 'Klee', 'Moos', 'Pilz', 'Farn',
    'Bach', 'Teich', 'Quelle', 'Küste', 'Düne', 'Herbstlaub',
  ],
  koerper: [
    'Kopf', 'Haar', 'Stirn', 'Auge', 'Augenbraue', 'Wimper', 'Nase', 'Mund', 'Lippe', 'Zahn',
    'Zunge', 'Kinn', 'Ohr', 'Hals', 'Nacken', 'Schulter', 'Arm', 'Ellenbogen', 'Handgelenk',
    'Hand', 'Finger', 'Daumen', 'Fingernagel', 'Brustkorb', 'Bauch', 'Rücken', 'Hüfte',
    'Bein', 'Knie', 'Wade', 'Knöchel', 'Fuß', 'Zeh', 'Ferse', 'Haut', 'Muskel', 'Knochen',
    'Herz', 'Lunge', 'Magen', 'Leber', 'Niere', 'Gehirn', 'Blut', 'Puls', 'Fieber', 'Husten',
    'Schnupfen', 'Kopfschmerzen', 'Pflaster',
  ],
  kleidung: [
    'Hemd', 'Bluse', 'T-Shirt', 'Pullover', 'Strickjacke', 'Weste', 'Jacke', 'Mantel',
    'Anorak', 'Regenjacke', 'Hose', 'Jeans', 'Shorts', 'Rock', 'Kleid', 'Anzug', 'Krawatte',
    'Fliege', 'Gürtel', 'Hosenträger', 'Socken', 'Strumpfhose', 'Unterhemd', 'Schlafanzug',
    'Bademantel', 'Badehose', 'Badeanzug', 'Bikini', 'Turnschuhe', 'Sandalen', 'Stiefel',
    'Gummistiefel', 'Hausschuhe', 'Wanderschuhe', 'Mütze', 'Hut', 'Kappe', 'Schal',
    'Handschuhe', 'Halstuch', 'Brille', 'Sonnenbrille', 'Armbanduhr', 'Ring', 'Halskette',
    'Ohrring', 'Handtasche', 'Geldbeutel', 'Regenschirm', 'Lätzchen',
  ],
  fahrzeuge: [
    'Auto', 'Fahrrad', 'Motorrad', 'Roller', 'Moped', 'Lastwagen', 'Lieferwagen', 'Bus',
    'Reisebus', 'Straßenbahn', 'U-Bahn', 'S-Bahn', 'Zug', 'Lokomotive', 'Güterzug', 'Taxi',
    'Krankenwagen', 'Feuerwehrauto', 'Polizeiauto', 'Müllwagen', 'Traktor', 'Mähdrescher',
    'Bagger', 'Kran', 'Gabelstapler', 'Betonmischer', 'Schneepflug', 'Wohnmobil', 'Anhänger',
    'Cabrio', 'Geländewagen', 'Sportwagen', 'Oldtimer', 'Rennwagen', 'Flugzeug',
    'Hubschrauber', 'Segelflugzeug', 'Heißluftballon', 'Rakete', 'Schiff', 'Segelboot',
    'Ruderboot', 'Kanu', 'Schlauchboot', 'U-Boot', 'Jetski', 'Seilbahn', 'Skilift',
    'Rollstuhl', 'Tretroller',
  ],
  spiele: [
    'Schach', 'Dame', 'Mühle', 'Halma', 'Backgammon', 'Mensch ärgere dich nicht', 'Monopoly',
    'Scrabble', 'Risiko', 'Die Siedler von Catan', 'Uno', 'Skat', 'Doppelkopf', 'Rommé',
    'Mau-Mau', 'Poker', 'Memory', 'Puzzle', 'Domino', 'Kniffel', 'Bingo', 'Sudoku',
    'Kreuzworträtsel', 'Verstecken', 'Fangen', 'Blinde Kuh', 'Topfschlagen',
    'Reise nach Jerusalem', 'Stille Post', 'Sackhüpfen', 'Gummitwist', 'Seilspringen',
    'Hüpfkästchen', 'Murmeln', 'Drachensteigen', 'Sandburg', 'Schaukel', 'Rutsche', 'Wippe',
    'Klettergerüst', 'Lego', 'Playmobil', 'Modelleisenbahn', 'Sammelalbum', 'Briefmarken',
    'Stricken', 'Häkeln', 'Basteln', 'Gartenarbeit', 'Angeln',
  ],
  feiertage: [
    'Weihnachten', 'Heiligabend', 'Silvester', 'Neujahr', 'Ostern', 'Karfreitag', 'Pfingsten',
    'Fronleichnam', 'Christi Himmelfahrt', 'Nikolaus', 'Advent', 'Adventskranz',
    'Weihnachtsbaum', 'Krippe', 'Weihnachtsmarkt', 'Plätzchen', 'Osterhase', 'Ostereier',
    'Eiersuche', 'Karneval', 'Fasching', 'Rosenmontag', 'Aschermittwoch', 'Muttertag',
    'Vatertag', 'Valentinstag', 'Halloween', 'Erntedankfest', 'Martinstag', 'Laternenumzug',
    'Schützenfest', 'Oktoberfest', 'Kirmes', 'Jahrmarkt', 'Geburtstag', 'Geburtstagstorte',
    'Hochzeit', 'Polterabend', 'Taufe', 'Kommunion', 'Konfirmation', 'Jubiläum', 'Richtfest',
    'Einschulung', 'Abschlussfeier', 'Feuerwerk', 'Girlande', 'Luftballon', 'Geschenk',
    'Festessen',
  ],
  gefuehle: [
    'Freude', 'Glück', 'Liebe', 'Zuneigung', 'Stolz', 'Dankbarkeit', 'Erleichterung',
    'Hoffnung', 'Vorfreude', 'Neugier', 'Begeisterung', 'Zufriedenheit', 'Geborgenheit',
    'Mitgefühl', 'Sehnsucht', 'Heimweh', 'Fernweh', 'Traurigkeit', 'Kummer', 'Enttäuschung',
    'Wut', 'Ärger', 'Zorn', 'Frust', 'Neid', 'Eifersucht', 'Angst', 'Panik', 'Sorge',
    'Nervosität', 'Aufregung', 'Scham', 'Schuldgefühl', 'Verlegenheit', 'Peinlichkeit',
    'Langeweile', 'Müdigkeit', 'Erschöpfung', 'Überraschung', 'Verwirrung', 'Zweifel',
    'Misstrauen', 'Einsamkeit', 'Heiterkeit', 'Schadenfreude', 'Gelassenheit', 'Ungeduld',
    'Respekt', 'Bewunderung', 'Zuversicht',
  ],
  stadt: [
    'Rathaus', 'Marktplatz', 'Kirche', 'Dom', 'Bushaltestelle', 'Fußgängerzone',
    'Einkaufszentrum', 'Supermarkt', 'Bäckerei', 'Metzgerei', 'Apotheke', 'Drogerie',
    'Buchhandlung', 'Blumenladen', 'Kiosk', 'Postfiliale', 'Bank', 'Geldautomat',
    'Bibliothek', 'Schwimmbad', 'Sporthalle', 'Stadion', 'Kino', 'Theater', 'Stadtmuseum',
    'Zoo', 'Stadtpark', 'Spielplatz', 'Friedhof', 'Krankenhaus', 'Feuerwache',
    'Polizeirevier', 'Ampel', 'Zebrastreifen', 'Kreisverkehr', 'Parkhaus', 'Baustelle',
    'Straßenlaterne', 'Mülleimer', 'Parkbank', 'Brunnen', 'Denkmal', 'Brücke', 'Tunnel',
    'Stau', 'Radweg', 'Bürgersteig', 'Hochhaus', 'Fahrkartenautomat', 'Wochenmarkt',
  ],
  maerchen: [
    'Schneewittchen', 'Aschenputtel', 'Dornröschen', 'Rotkäppchen', 'Rapunzel',
    'Hänsel und Gretel', 'Frau Holle', 'Rumpelstilzchen', 'Der Froschkönig',
    'Die Bremer Stadtmusikanten', 'Der gestiefelte Kater', 'Tischlein deck dich',
    'Das tapfere Schneiderlein', 'Die Sterntaler', 'Der Wolf und die sieben Geißlein',
    'Peter Pan', 'Pinocchio', 'Alice im Wunderland', 'Der kleine Prinz', 'Robin Hood',
    'König Artus', 'Drache', 'Ritter', 'Prinzessin', 'Prinz', 'König', 'Königin', 'Hexe',
    'Zauberer', 'Fee', 'Elfe', 'Zwerg', 'Riese', 'Troll', 'Kobold', 'Einhorn',
    'Meerjungfrau', 'Vampir', 'Werwolf', 'Gespenst', 'Zauberstab', 'Zaubertrank',
    'Zauberspiegel', 'Märchenschloss', 'Verwunschener Wald', 'Goldene Kugel', 'Glasschuh',
    'Spinnrad', 'Siebenmeilenstiefel', 'Wunschbrunnen',
  ],
  beruehmt: [
    'Albert Einstein', 'Isaac Newton', 'Marie Curie', 'Charles Darwin', 'Leonardo da Vinci',
    'Michelangelo', 'Vincent van Gogh', 'Pablo Picasso', 'Ludwig van Beethoven',
    'Wolfgang Amadeus Mozart', 'Johann Sebastian Bach', 'Johann Wolfgang von Goethe',
    'Friedrich Schiller', 'Die Gebrüder Grimm', 'William Shakespeare', 'Astrid Lindgren',
    'Anne Frank', 'Martin Luther', 'Martin Luther King', 'Mahatma Gandhi', 'Nelson Mandela',
    'Mutter Teresa', 'Winston Churchill', 'Konrad Adenauer', 'Angela Merkel', 'Helmut Kohl',
    'Christoph Kolumbus', 'Neil Armstrong', 'Alexander von Humboldt', 'Karl der Große',
    'Napoleon', 'Kleopatra', 'Julius Cäsar', 'Elvis Presley', 'Michael Jackson',
    'Die Beatles', 'Freddie Mercury', 'Marilyn Monroe', 'Charlie Chaplin', 'Walt Disney',
    'Steve Jobs', 'Bill Gates', 'Muhammad Ali', 'Pelé', 'Franz Beckenbauer',
    'Michael Schumacher', 'Steffi Graf', 'Boris Becker', 'Dirk Nowitzki', 'Usain Bolt',
  ],
}

export const WORDS: WordEntry[] = Object.entries(BY_CATEGORY).flatMap(([categoryId, words]) =>
  words.map((word) => ({ word, categoryId })),
)

export function wordsForCategory(categoryId: string): WordEntry[] {
  return WORDS.filter((w) => w.categoryId === categoryId)
}
