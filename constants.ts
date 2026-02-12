
import { Dialogue, Word } from './types';

export const INITIAL_DIALOGUES: Dialogue[] = [
  {
    id: 1,
    title: "카페에서 주문하기",
    category: "식사",
    turns: [
      { id: 101, speaker: "A", english: "Hi there! What can I get for you today?", korean: "안녕하세요! 무엇을 도와드릴까요?" },
      { id: 102, speaker: "B", english: "I'd like to order a coffee, please.", korean: "커피 한 잔 주문하고 싶어요." },
      { id: 103, speaker: "A", english: "Sure. Would you like that hot or iced?", korean: "네. 따뜻한 걸로 드릴까요, 아이스로 드릴까요?" },
      { id: 104, speaker: "B", english: "Iced americano, please.", korean: "아이스 아메리카노로 주세요." }
    ]
  },
  {
    id: 2,
    title: "처음 만났을 때",
    category: "인사",
    turns: [
      { id: 201, speaker: "A", english: "Hello, my name is Alex. Nice to meet you.", korean: "안녕하세요, 제 이름은 알렉스예요. 만나서 반가워요." },
      { id: 202, speaker: "B", english: "It's a pleasure to meet you too.", korean: "저도 만나서 정말 반가워요." },
      { id: 203, speaker: "A", english: "What do you do for a living?", korean: "어떤 일을 하세요?" },
      { id: 204, speaker: "B", english: "I work as a software engineer.", korean: "저는 소프트웨어 엔지니어로 일하고 있어요." }
    ]
  }
];

export const INITIAL_WORDS: Word[] = [
  { id: 1001, english: "Definitely", korean: "분명히 / 절대로", category: "부사" },
  { id: 1002, english: "Appointment", korean: "약속 / 예약", category: "명사" },
  { id: 1003, english: "Fortunately", korean: "다행히도", category: "부사" },
  { id: 1004, english: "Opportunity", korean: "기회", category: "명사" },
  { id: 1005, english: "Recommend", korean: "추천하다", category: "동사" }
];

export const LOCAL_STORAGE_KEY = 'echomaster_user_data_v3';
export const DEFAULT_DAILY_GOAL = 20;
export const DEFAULT_ACCURACY_THRESHOLD = 80;
