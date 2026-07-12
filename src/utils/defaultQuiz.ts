import type { Quiz } from '../types/jeopardy';

export const DEFAULT_QUIZ: Quiz = {
  id: 'default-quiz-jeopardy',
  title: 'Ultimate Trivia Showdown',
  description: 'A premium mix of Geography, Tech, History, Pop Culture, Space, and Word Play.',
  createdAt: 1718000000000,
  categories: [
    {
      id: 'cat-geo',
      name: 'World Geography',
      questions: [
        { id: 'q-geo-10', text: 'This is the longest river in the world, spanning over 4,100 miles across Africa.', answer: 'The Nile', value: 100, type: 'text' },
        { id: 'q-geo-20', text: 'This landlocked country is completely surrounded by the territory of South Africa.', answer: 'Lesotho', value: 200, type: 'text' },
        { id: 'q-geo-30', text: 'This massive sandstone monolith in the Northern Territory of Australia is sacred to the indigenous Anangu people.', answer: 'Uluru (or Ayers Rock)', value: 300, type: 'text' },
        { id: 'q-geo-40', text: 'This is the largest ocean in the world, covering more than 30% of the Earth\'s entire surface.', answer: 'The Pacific Ocean', value: 400, type: 'text' },
        { id: 'q-geo-50', text: 'This European capital city is built on 14 islands, connected by 57 bridges, and is often called the "Venice of the North".', answer: 'Stockholm', value: 500, type: 'text' },
      ],
    },
    {
      id: 'cat-tech',
      name: 'Tech & Science',
      questions: [
        { id: 'q-tech-10', text: 'This unit of electric resistance is named after a prominent German physicist.', answer: 'Ohm', value: 100, type: 'text' },
        { id: 'q-tech-20', text: 'This is the name of the nearest major spiral galaxy to our own Milky Way.', answer: 'Andromeda', value: 200, type: 'text' },
        { id: 'q-tech-30', text: 'This chemical element has the symbol "W" and is known for having the highest melting point of all elements.', answer: 'Tungsten', value: 300, type: 'text' },
        { id: 'q-tech-40', text: 'Often referred to as the father of computer science, this British mathematician cracked the German Enigma code.', answer: 'Alan Turing', value: 400, type: 'text' },
        { id: 'q-tech-50', text: 'This programming language, created by Brendan Eich in 1995 in just 10 days, powers the interactive web.', answer: 'JavaScript', value: 500, type: 'text' },
      ],
    },
    {
      id: 'cat-pop',
      name: 'Pop Culture',
      questions: [
        { id: 'q-pop-10', text: 'This fictional detective created by Sir Arthur Conan Doyle resides at 221B Baker Street in London.', answer: 'Sherlock Holmes', value: 100, type: 'text' },
        { id: 'q-pop-20', text: 'This Canadian artist released the record-breaking hit single "Blinding Lights" in late 2019.', answer: 'The Weeknd', value: 200, type: 'text' },
        { id: 'q-pop-30', text: 'Which American actor portrayed Iron Man (Tony Stark) in the Marvel Cinematic Universe from 2008 to 2019?', answer: 'Robert Downey Jr.', value: 300, type: 'text' },
        { id: 'q-pop-40', text: 'This is the name of the main fictional continent where the majority of the events in "Game of Thrones" take place.', answer: 'Westeros', value: 400, type: 'text' },
        { id: 'q-pop-50', text: 'What is the name of the wizarding school attended by Harry Potter in J.K. Rowling\'s series?', answer: 'Hogwarts', value: 500, type: 'text' },
      ],
    },
    {
      id: 'cat-hist',
      name: 'History',
      questions: [
        { id: 'q-hist-10', text: 'This French national heroine led the French army to victory at Orléans but was burned at the stake in 1431.', answer: 'Joan of Arc', value: 100, type: 'text' },
        { id: 'q-hist-20', text: 'The Magna Carta, which limited the powers of the King of England, was signed by King John in this year.', answer: '1215', value: 200, type: 'text' },
        { id: 'q-hist-30', text: 'This American president delivered the historic 272-word Gettysburg Address during the American Civil War.', answer: 'Abraham Lincoln', value: 300, type: 'text' },
        { id: 'q-hist-40', text: 'This empire, founded in 1299 and dissolved in 1922, had its seat of power in Constantinople (now Istanbul).', answer: 'The Ottoman Empire', value: 400, type: 'text' },
        { id: 'q-hist-50', text: 'The Berlin Wall, which divided East and West Germany for 28 years, officially fell on this date.', answer: 'November 9, 1989', value: 500, type: 'text' },
      ],
    },
    {
      id: 'cat-space',
      name: 'Space Exploration',
      questions: [
        { id: 'q-space-10', text: 'Due to its iron oxide-rich soil, this solar system planet is nicknamed the "Red Planet".', answer: 'Mars', value: 100, type: 'text' },
        { id: 'q-space-20', text: 'In July 1969, this American astronaut became the first human to ever set foot on the moon.', answer: 'Neil Armstrong', value: 200, type: 'text' },
        { id: 'q-space-30', text: 'This boundary surrounding a black hole is the physical threshold beyond which nothing, not even light, can escape.', answer: 'Event Horizon', value: 300, type: 'text' },
        { id: 'q-space-40', text: 'This is the name of the very first artificial satellite launched into Earth orbit by the Soviet Union in 1957.', answer: 'Sputnik 1', value: 400, type: 'text' },
        { id: 'q-space-50', text: 'This giant space telescope was launched in December 2021 and is designed to observe the earliest galaxies in the universe.', answer: 'James Webb Space Telescope (JWST)', value: 500, type: 'text' },
      ],
    },
    {
      id: 'cat-word',
      name: 'Word Play',
      questions: [
        { id: 'q-word-10', text: 'The more of them you take, the more of them you leave behind. What are they?', answer: 'Footsteps', value: 100, type: 'text' },
        { id: 'q-word-20', text: 'What word in the English dictionary becomes shorter when you add two letters to it?', answer: 'Short', value: 200, type: 'text' },
        { id: 'q-word-30', text: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'An Echo', value: 300, type: 'text' },
        { id: 'q-word-40', text: 'This 11-letter English word begins with "E", ends with "E", and contains only one letter.', answer: 'An Envelope', value: 400, type: 'text' },
        { id: 'q-word-50', text: 'I have cities, but no houses live there. I have mountains, but no trees grow. I have water, but no fish swim. I have roads, but no cars drive. What am I?', answer: 'A Map', value: 500, type: 'text' },
      ],
    },
  ],
};
