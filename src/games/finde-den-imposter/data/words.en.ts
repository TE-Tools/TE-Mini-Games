import type { WordEntry } from '../types'

/**
 * Der eingebaute englische Wortschatz -- 50 Wörter je Kategorie, zusammen 1000
 * (06.11.2026). Gespielt von Finde den Imposter, Wer bin ich? und Scharade.
 *
 * Keine Übersetzung der deutschen Liste, sondern eine eigene für Leute, die
 * auf Englisch spielen: Thanksgiving statt Schützenfest, Goldilocks statt
 * Frau Holle. Es gelten dieselben Regeln wie in words.ts:
 *  - Alltagswörter, die am Tisch jeder kennt. Britisch und amerikanisch
 *    gemischt, im Zweifel die Form, die beide verstehen.
 *  - Innerhalb einer Kategorie keine Dopplungen und möglichst keine
 *    Fast-Synonyme -- das Hilfswort der Imposter kommt aus derselben Kategorie.
 *  - Jedes Wort steht in mindestens einer Gruppe in helperClusters.en.ts.
 *
 * Die Kennungen tragen das Präfix `en-`; die Kategorien stehen in
 * categories.ts. Online stehen die Wörter in
 * supabase/migrations/029_englische_woerter.sql -- nach Änderungen
 * `node scripts/build-imposter-words-sql.mjs` laufen lassen.
 */
// Kompakt wie in words.ts -- eine Zeile je Wort wären 1000 Zeilen.
// prettier-ignore
export const BY_CATEGORY_EN: Record<string, string[]> = {
  'en-tiere': [
    'Dog', 'Cat', 'Horse', 'Cow', 'Pig', 'Chicken', 'Duck', 'Goose', 'Sheep', 'Goat', 'Rabbit',
    'Fox', 'Wolf', 'Bear', 'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Monkey', 'Penguin', 'Dolphin',
    'Shark', 'Whale', 'Eagle', 'Owl', 'Parrot', 'Bee', 'Ant', 'Spider', 'Butterfly', 'Frog',
    'Turtle', 'Snake', 'Crocodile', 'Hedgehog', 'Squirrel', 'Mouse', 'Bat', 'Deer', 'Camel',
    'Zebra', 'Kangaroo', 'Koala', 'Panda', 'Hippo', 'Octopus', 'Flamingo', 'Ladybug', 'Rhino',
    'Seal',
  ],
  'en-essen': [
    'Pizza', 'Bread', 'Butter', 'Cheese', 'Milk', 'Yogurt', 'Apple', 'Banana', 'Strawberry',
    'Cherry', 'Grapes', 'Lemon', 'Potato', 'Carrot', 'Cucumber', 'Tomato', 'Onion', 'Garlic',
    'Lettuce', 'Rice', 'Pasta', 'Soup', 'Steak', 'Sausage', 'Bacon', 'Fried Egg', 'Pancake', 'Cake',
    'Cookie', 'Chocolate', 'Ice Cream', 'Honey', 'Jam', 'Cereal', 'Toast', 'Sandwich', 'Burger',
    'Hot Dog', 'French Fries', 'Fish and Chips', 'Curry', 'Tacos', 'Coffee', 'Tea', 'Hot Chocolate',
    'Orange Juice', 'Lemonade', 'Milkshake', 'Smoothie', 'Doughnut',
  ],
  'en-berufe': [
    'Doctor', 'Nurse', 'Teacher', 'Police Officer', 'Firefighter', 'Baker', 'Butcher', 'Chef',
    'Waiter', 'Hairdresser', 'Gardener', 'Farmer', 'Vet', 'Pharmacist', 'Dentist', 'Lawyer',
    'Judge', 'Cashier', 'Shop Assistant', 'Postman', 'Bus Driver', 'Train Driver', 'Pilot',
    'Flight Attendant', 'Sailor', 'Electrician', 'Plumber', 'Painter', 'Builder', 'Carpenter',
    'Mechanic', 'Engineer', 'Architect', 'Programmer', 'Journalist', 'Photographer', 'Musician',
    'Actor', 'Singer', 'Librarian', 'Cleaner', 'Optician', 'Physiotherapist', 'Accountant',
    'Soldier', 'Scientist', 'Astronaut', 'Lifeguard', 'Zookeeper', 'Dancer',
  ],
  'en-sport': [
    'Soccer', 'Basketball', 'Volleyball', 'Baseball', 'American Football', 'Rugby', 'Cricket',
    'Tennis', 'Table Tennis', 'Badminton', 'Golf', 'Ice Hockey', 'Swimming', 'Diving', 'Rowing',
    'Sailing', 'Surfing', 'Climbing', 'Hiking', 'Jogging', 'Marathon', 'Cycling', 'Horse Riding',
    'Gymnastics', 'Long Jump', 'High Jump', 'Javelin', 'Boxing', 'Judo', 'Karate', 'Wrestling',
    'Fencing', 'Skiing', 'Snowboarding', 'Ice Skating', 'Archery', 'Bowling', 'Darts', 'Billiards',
    'Yoga', 'Weightlifting', 'Triathlon', 'Skateboarding', 'Water Polo', 'Go-Karting', 'Squash',
    'Trampolining', 'Kayaking', 'Sprinting', 'Pole Vault',
  ],
  'en-reisen': [
    'Beach', 'Mountain', 'Island', 'Desert', 'Jungle', 'Ocean', 'Hotel', 'Campsite', 'Tent',
    'Camper Van', 'Airport', 'Train Station', 'Harbour', 'Ferry', 'Cruise', 'Road Trip', 'Suitcase',
    'Backpack', 'Passport', 'Map', 'Sunscreen', 'Postcard', 'Souvenir', 'Sightseeing', 'Museum',
    'Castle', 'Lighthouse', 'Waterfall', 'Cave', 'Lake', 'River', 'Theme Park', 'London', 'Paris',
    'New York', 'Rome', 'Sydney', 'Tokyo', 'Dublin', 'Edinburgh', 'Venice', 'Barcelona',
    'Las Vegas', 'Australia', 'Canada', 'Mexico', 'Egypt', 'Japan', 'Spain', 'Hawaii',
  ],
  'en-technik': [
    'Smartphone', 'Tablet', 'Laptop', 'Computer', 'Screen', 'Keyboard', 'Mouse', 'Smartwatch',
    'Printer', 'Router', 'Wi-Fi', 'Bluetooth', 'USB Stick', 'Hard Drive', 'Headphones', 'Speaker',
    'Television', 'Remote Control', 'Projector', 'Camera', 'Drone', 'Games Console',
    'Virtual Reality', 'Charger', 'Power Bank', 'Socket', 'Battery', 'Flashlight', 'Solar Panel',
    'Wind Turbine', 'Robot', 'Voice Assistant', 'App', 'Password', 'Email', 'Search Engine',
    'Video Call', 'Streaming', 'Update', 'Microwave', 'Washing Machine', 'Vacuum Cleaner', 'Fridge',
    'Dishwasher', 'Hairdryer', 'Drill', 'Lawnmower', 'GPS', 'Air Conditioning', 'Sewing Machine',
  ],
  'en-filme': [
    'Titanic', 'Avatar', 'The Matrix', 'Jurassic Park', 'Star Wars', 'The Lord of the Rings',
    'Harry Potter', 'Back to the Future', 'Ghostbusters', 'E.T.', 'The Wizard of Oz',
    'Mary Poppins', 'James Bond', 'Indiana Jones', 'Spider-Man', 'Batman', 'Superman', 'Rocky',
    'Finding Nemo', 'The Lion King', 'Shrek', 'Frozen', 'Minions', 'Toy Story', 'Ice Age',
    'The Jungle Book', 'Paddington', 'Doctor Who', 'Friends', 'The Simpsons', 'Stranger Things',
    'Mr Bean', 'Sesame Street', 'SpongeBob', 'Peppa Pig', 'Cinema', 'Popcorn', 'Soundtrack',
    'Credits', 'Director', 'Script', 'Trailer', 'Oscar', 'Sequel', 'Cartoon', 'Documentary',
    'Premiere', 'Costume', 'Stunt', 'Red Carpet',
  ],
  'en-musik': [
    'Guitar', 'Electric Guitar', 'Bass', 'Drums', 'Piano', 'Violin', 'Cello', 'Flute', 'Recorder',
    'Clarinet', 'Saxophone', 'Trumpet', 'Trombone', 'Tuba', 'French Horn', 'Harp', 'Accordion',
    'Harmonica', 'Xylophone', 'Triangle', 'Tambourine', 'Organ', 'Keyboard', 'Microphone', 'Choir',
    'Orchestra', 'Band', 'Conductor', 'Concert', 'Festival', 'Sheet Music', 'Beat', 'Chorus',
    'Verse', 'Melody', 'Rhythm', 'Pop', 'Rock', 'Jazz', 'Classical', 'Hip-Hop', 'Country', 'Reggae',
    'Opera', 'Radio', 'Record Player', 'Karaoke', 'Ukulele', 'Banjo', 'Lullaby',
  ],
  'en-schule': [
    'Whiteboard', 'Exercise Book', 'Textbook', 'Pencil Case', 'Pen', 'Eraser', 'Ruler',
    'Calculator', 'Glue Stick', 'Scissors', 'Highlighter', 'School Bag', 'Lunchbox', 'Playground',
    'School Bell', 'Timetable', 'Homework', 'Break Time', 'Locker', 'Cafeteria', 'School Bus',
    'Uniform', 'Exam', 'Report Card', 'Grade', 'Detention', 'Spelling Bee', 'Field Trip',
    'Sports Day', 'Assembly', 'Show and Tell', 'Prom', 'Yearbook', 'Graduation', 'Summer Holidays',
    'Mathematics', 'English', 'French', 'Science', 'History', 'Geography', 'Art', 'PE', 'Chemistry',
    'Physics', 'Principal', 'Classmate', 'Staff Room', 'Library', "Parents' Evening",
  ],
  'en-haus': [
    'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway', 'Basement', 'Attic', 'Garage',
    'Balcony', 'Patio', 'Garden', 'Stairs', 'Window', 'Front Door', 'Roof', 'Chimney', 'Fireplace',
    'Doorbell', 'Sofa', 'Armchair', 'Coffee Table', 'Dining Table', 'Chair', 'Bed', 'Bunk Bed',
    'Mattress', 'Pillow', 'Blanket', 'Wardrobe', 'Chest of Drawers', 'Bookshelf', 'Rug', 'Curtains',
    'Lamp', 'Chandelier', 'Mirror', 'Picture Frame', 'Plant Pot', 'Light Switch', 'Oven', 'Sink',
    'Bathtub', 'Shower', 'Toilet', 'Radiator', 'Mailbox', 'Fence', 'Hedge', 'Garden Gnome',
    'Doormat',
  ],
  'en-natur': [
    'Sun', 'Moon', 'Stars', 'Cloud', 'Rain', 'Snow', 'Hail', 'Fog', 'Wind', 'Storm', 'Lightning',
    'Thunder', 'Rainbow', 'Frost', 'Dew', 'Heatwave', 'Tornado', 'Icicle', 'Drought', 'Flood',
    'Avalanche', 'Earthquake', 'Volcano', 'Glacier', 'Forest', 'Meadow', 'Field', 'Swamp', 'Moss',
    'Mushroom', 'Fern', 'Cliff', 'Tree', 'Oak', 'Pine', 'Willow', 'Palm Tree', 'Flower', 'Rose',
    'Tulip', 'Sunflower', 'Daisy', 'Dandelion', 'Clover', 'Stream', 'Pond', 'Coast', 'Sand Dune',
    'Autumn Leaves', 'Puddle',
  ],
  'en-koerper': [
    'Head', 'Hair', 'Forehead', 'Eye', 'Eyebrow', 'Eyelash', 'Nose', 'Mouth', 'Lip', 'Tooth',
    'Tongue', 'Chin', 'Ear', 'Freckle', 'Neck', 'Shoulder', 'Arm', 'Elbow', 'Wrist', 'Hand',
    'Finger', 'Thumb', 'Fingernail', 'Chest', 'Belly', 'Back', 'Hip', 'Leg', 'Knee', 'Ankle',
    'Foot', 'Toe', 'Heel', 'Skin', 'Muscle', 'Bone', 'Heart', 'Lungs', 'Stomach', 'Liver', 'Kidney',
    'Brain', 'Blood', 'Pulse', 'Fever', 'Cough', 'Sneeze', 'Headache', 'Bandage', 'Hiccups',
  ],
  'en-kleidung': [
    'Shirt', 'Blouse', 'T-Shirt', 'Sweater', 'Cardigan', 'Hoodie', 'Jacket', 'Coat', 'Raincoat',
    'Trousers', 'Jeans', 'Shorts', 'Skirt', 'Dress', 'Suit', 'Tie', 'Bow Tie', 'Belt', 'Leggings',
    'Socks', 'Tights', 'Pyjamas', 'Bathrobe', 'Swimsuit', 'Bikini', 'Onesie', 'Sneakers', 'Sandals',
    'Boots', 'Flip-Flops', 'Slippers', 'High Heels', 'Hat', 'Cap', 'Beanie', 'Scarf', 'Gloves',
    'Mittens', 'Earmuffs', 'Glasses', 'Sunglasses', 'Watch', 'Ring', 'Necklace', 'Earrings',
    'Bracelet', 'Handbag', 'Wallet', 'Umbrella', 'Apron',
  ],
  'en-fahrzeuge': [
    'Car', 'Convertible', 'Sports Car', 'Vintage Car', 'Race Car', 'Taxi', 'Limousine',
    'Pickup Truck', 'Bicycle', 'Motorbike', 'Scooter', 'Moped', 'Skateboard', 'Wheelchair',
    'Unicycle', 'Truck', 'Van', 'Bus', 'Double-Decker Bus', 'Garbage Truck', 'Motorhome', 'Trailer',
    'Tram', 'Subway', 'Train', 'Steam Train', 'Freight Train', 'Monorail', 'Ambulance',
    'Fire Engine', 'Police Car', 'Tractor', 'Combine Harvester', 'Digger', 'Crane', 'Forklift',
    'Cement Mixer', 'Bulldozer', 'Plane', 'Helicopter', 'Glider', 'Hot Air Balloon', 'Rocket',
    'Cable Car', 'Ski Lift', 'Ship', 'Sailboat', 'Rowboat', 'Canoe', 'Submarine',
  ],
  'en-spiele': [
    'Chess', 'Checkers', 'Backgammon', 'Monopoly', 'Scrabble', 'Snakes and Ladders', 'Ludo', 'Uno',
    'Poker', 'Solitaire', 'Snap', 'Go Fish', 'Jigsaw Puzzle', 'Dominoes', 'Bingo', 'Sudoku',
    'Crossword', "Rubik's Cube", 'Hide and Seek', 'Tag', 'Musical Chairs', 'Hopscotch',
    'Skipping Rope', 'Simon Says', 'Treasure Hunt', 'Sack Race', 'Egg and Spoon Race', 'Marbles',
    'Kite', 'Sandcastle', 'Swing', 'Slide', 'Seesaw', 'Climbing Frame', 'Lego', 'Train Set',
    'Sticker Album', 'Stamp Collecting', 'Video Games', "Doll's House", 'Knitting', 'Crochet',
    'Arts and Crafts', 'Gardening', 'Fishing', 'Baking', 'Painting', 'Photography', 'Reading',
    'Birdwatching',
  ],
  'en-feiertage': [
    'Christmas', 'Christmas Eve', 'Boxing Day', 'Advent Calendar', 'Christmas Tree', 'Stocking',
    'Santa Claus', 'Reindeer', 'Mistletoe', 'Christmas Cracker', 'Nativity Play', 'Carol Singing',
    'Easter', 'Good Friday', 'Easter Bunny', 'Easter Egg Hunt', 'Pancake Day', "New Year's Eve",
    "New Year's Day", 'Fireworks', 'Chinese New Year', 'Halloween', 'Trick or Treat',
    "Jack-o'-Lantern", 'Thanksgiving', 'Bonfire Night', "St Patrick's Day", "Valentine's Day",
    "Mother's Day", "Father's Day", 'Fourth of July', "April Fools' Day", 'Hanukkah', 'Diwali',
    'Eid', 'Carnival', 'Birthday', 'Birthday Cake', 'Balloons', 'Present', 'Party Hat', 'Piñata',
    'Bunting', 'Surprise Party', 'Wedding', 'Baby Shower', 'Graduation', 'Anniversary',
    'Housewarming', 'Retirement Party',
  ],
  'en-gefuehle': [
    'Joy', 'Happiness', 'Love', 'Pride', 'Gratitude', 'Relief', 'Hope', 'Excitement', 'Curiosity',
    'Calm', 'Confidence', 'Sympathy', 'Respect', 'Admiration', 'Trust', 'Optimism', 'Courage',
    'Amusement', 'Homesickness', 'Wanderlust', 'Nostalgia', 'Sadness', 'Grief', 'Disappointment',
    'Loneliness', 'Heartbreak', 'Anger', 'Annoyance', 'Frustration', 'Envy', 'Jealousy',
    'Grumpiness', 'Fear', 'Panic', 'Worry', 'Nervousness', 'Stress', 'Stage Fright', 'Shame',
    'Guilt', 'Embarrassment', 'Shyness', 'Boredom', 'Tiredness', 'Impatience', 'Laziness',
    'Surprise', 'Confusion', 'Doubt', 'Suspicion',
  ],
  'en-stadt': [
    'Town Hall', 'Market Square', 'Church', 'Cathedral', 'Main Street', 'Shopping Mall',
    'Skyscraper', 'Supermarket', 'Bakery', 'Pharmacy', 'Bookshop', 'Florist', 'Café', 'Restaurant',
    "Farmers' Market", 'Post Office', 'Bank', 'Cash Machine', 'Library', 'Ticket Machine',
    'Car Wash', 'Bus Stop', 'Car Park', 'Traffic Lights', 'Pedestrian Crossing', 'Roundabout',
    'Cycle Lane', 'Sidewalk', 'Bridge', 'Tunnel', 'Traffic Jam', 'Swimming Pool', 'Stadium',
    'Cinema', 'Theatre', 'Art Gallery', 'Zoo', 'Park', 'Playground', 'Gym', 'Cemetery', 'Hospital',
    'Fire Station', 'Police Station', 'Construction Site', 'Street Lamp', 'Litter Bin',
    'Park Bench', 'Fountain', 'Statue',
  ],
  'en-maerchen': [
    'Snow White', 'Cinderella', 'Sleeping Beauty', 'Little Red Riding Hood', 'Rapunzel',
    'Hansel and Gretel', 'Rumpelstiltskin', 'The Frog Prince', 'Puss in Boots',
    'Jack and the Beanstalk', 'Goldilocks', 'The Three Little Pigs', 'The Ugly Duckling',
    'Beauty and the Beast', 'The Gingerbread Man', 'Humpty Dumpty', 'Peter Pan', 'Pinocchio',
    'Alice in Wonderland', 'Robin Hood', 'King Arthur', 'Merlin', 'Aladdin', 'Dragon', 'Knight',
    'Princess', 'King', 'Queen', 'Witch', 'Wizard', 'Fairy', 'Elf', 'Dwarf', 'Giant', 'Troll',
    'Goblin', 'Unicorn', 'Mermaid', 'Ghost', 'Vampire', 'Werewolf', 'Tooth Fairy', 'Magic Wand',
    'Potion', 'Magic Mirror', 'Glass Slipper', 'Flying Carpet', 'Crystal Ball', 'Wishing Well',
    'Gingerbread House',
  ],
  'en-beruehmt': [
    'Albert Einstein', 'Isaac Newton', 'Marie Curie', 'Charles Darwin', 'Stephen Hawking',
    'Thomas Edison', 'Leonardo da Vinci', 'Michelangelo', 'Vincent van Gogh', 'Pablo Picasso',
    'Ludwig van Beethoven', 'Wolfgang Amadeus Mozart', 'William Shakespeare', 'Charles Dickens',
    'Jane Austen', 'Roald Dahl', 'Agatha Christie', 'Anne Frank', 'Martin Luther King',
    'Mahatma Gandhi', 'Nelson Mandela', 'Mother Teresa', 'Florence Nightingale', 'Abraham Lincoln',
    'George Washington', 'Winston Churchill', 'Queen Elizabeth II', 'Henry VIII',
    'Christopher Columbus', 'Neil Armstrong', 'Amelia Earhart', 'Napoleon', 'Cleopatra',
    'Julius Caesar', 'Elvis Presley', 'The Beatles', 'Freddie Mercury', 'Frank Sinatra',
    'Taylor Swift', 'Marilyn Monroe', 'Charlie Chaplin', 'Walt Disney', 'Steve Jobs', 'Bill Gates',
    'Muhammad Ali', 'Pelé', 'Serena Williams', 'Usain Bolt', 'Michael Jordan', 'David Beckham',
  ],
}

export const WORDS_EN: WordEntry[] = Object.entries(BY_CATEGORY_EN).flatMap(([categoryId, words]) =>
  words.map((word) => ({ word, categoryId })),
)
