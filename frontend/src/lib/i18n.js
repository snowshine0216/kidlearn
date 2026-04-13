/**
 * Minimal i18n for StarCards.
 * Stored in localStorage as 'starcards_lang'. Default: 'zh'.
 *
 * Usage:
 *   import { useT } from '../lib/i18n';
 *   const t = useT();     // returns t.generate, t.subjects.chinese, etc.
 */

export const LANG_KEY = 'starcards_lang';
export const DEFAULT_LANG = 'zh';

const STRINGS = {
  zh: {
    appName: '✦ 星卡',
    streakBadge: (n) => `🔥 ${n}天连续`,
    viewDeck: '查看卡组',

    // InputPanel
    subjectLabel: '科目',
    subjects: { chinese: '🇨🇳 中文', english: '🇬🇧 英文', math: '🔢 数学' },
    placeholders: {
      chinese: '例如：苹果',
      english: '例如：butterfly',
      math: '例如：数数到10',
    },
    inputHint: '输入她不会的词 — AI 自动生成闪卡',
    generate: '✨ 生成闪卡',
    generating: '✨ 创作中...',
    recentLabel: '最近',

    // FlashCard
    emptyState: '在上方输入词语来生成第一张卡 ✨',
    iKnowIt: '✓ 我会了',
    notYet: '✗ 还不会',

    // CardActions
    saveToDeck: '+ 保存',
    saved: '✓ 已保存',
    hearIt: '🔊 听一听',
    print: '🖨 打印',

    // StatsRow
    noCardsYet: '还没有卡片 — 先保存一张！',
    cardCount: (n) => `⭐ 已保存 ${n} 张卡片`,

    // DeckView
    deckTitle: (n) => `我的卡组（${n}）`,
    filterAll: '全部',
    filterLabels: { english: '🇬🇧 英文', chinese: '🇨🇳 中文', math: '🔢 数学' },
    deckEmpty: '还没有卡片！让家长来生成一些吧 ✨',
    generateFirst: '生成第一张卡',
    filterEmpty: (subject) => `还没有 ${subject} 卡片`,
    clearFilter: '清除筛选',
    exportDeck: '↓ 导出卡组（JSON）',
    confirmDelete: '删除',
    cancelDelete: '取消',
    close: '✕',

    // Toasts
    cardSaved: '卡片已保存到卡组 ✓',

    // API key banner
    apiKeyMissing: 'API 密钥未配置 — 请复制 .env.example 到 .env.local 并填写密钥。',
    getKey: '获取密钥 →',

    // Lang toggle (shows the OTHER language you'd switch to)
    langToggle: 'EN',

    // Quiz Mode
    startQuiz: '🎯 开始测验',
    quizNeedCards: '需要至少 5 张卡片才能开始测验',
    quizSubjectLabel: '测验科目',
    quizCountLabel: '题目数量',
    quizModeLabels: { pronunciation: '跟读发音', fillBlank: '选择填空', wordMeaning: '词义配对', reading: '认字朗读', chineseMeaning: '听中选英' },
    quizStart: '开始 🚀',
    quizStartLoading: '准备中...',
    quizProgress: (n, total) => `第 ${n} / ${total} 题`,
    quizPrompt: {
      pronunciation: '这个词怎么读？',
      fillBlank: '选择空格里的正确单词：',
      wordMeaning: '这个词是什么意思？',
      reading: '你会读这个字吗？',
      chineseMeaning: '听一听，选出正确的英文单词：',
    },
    quizHintBtn: '💡 提示',
    quizSaidIt: '我说出来啦！✅',
    quizSkip: '还不会 🤔',
    quizKnowIt: '会！我会读 🗣️',
    quizDontKnow: '不太会... 😅',
    quizCorrectBanner: '太棒了！答对啦 🎉',
    quizWrongBanner: (word) => `继续加油！正确答案是「${word}」`,
    quizMemoryHelper: '🧠 记忆小贴士',
    quizGotIt: '明白了，继续 →',
    quizNext: '下一题 →',
    quizFinish: '查看结果',
    quizMascotCorrect: ['哇！你真棒！', '继续保持！⭐', '答对啦！真聪明！', '太厉害了！🌟', '棒棒哒！'],
    quizMascotWrong: ['没关系，继续努力！', '再看看这张卡片吧 🐼', '下次一定行！', '多练习就会了！'],
    quizMascotEmpathy: ['哎呀，差一点！让我们一起看看 👀', '没事的！来认识一下这个词 🌱', '学习需要时间，我们一起来！'],
    quizSummaryTitle: '测验完成！🎊',
    quizStars: (n) => `你得了 ${n} 颗星 ⭐`,
    quizScoreMsg: (correct, total) => `答对了 ${correct} / ${total} 道题`,
    quizScoreLow: '再练习一次就会更好！加油 💪',
    quizScoreMid: '做得不错！继续努力吧 🌟',
    quizScoreHigh: '太棒了！你学得很快！🏆',
    quizScorePerfect: '全部答对！你是超级学霸！🥇',
    quizWeakTitle: '需要多练习的词：',
    quizBack: '← 返回',
    quizDisable: '跳过测验',
    quizEnable: '加入测验',
    quizRestart: '再来一次 🔄',
    quizRetryFailed: '再练失误的词 🔁',
    quizBackToDeck: '返回卡组',
    quizShowCountdown: '⏱️ 倒计时',
    quizCountdownOn: '开启',
    quizCountdownOff: '关闭',
    quizTimeUp: '⏰ 时间到！',
    quizSelfPraise: '太棒了！你说出来了！🌟',
    quizRememberIt: '记住它 💡',
    dueForReview: (n) => n > 0 ? `${n} 张需要复习` : '',
  },

  en: {
    appName: '✦ StarCards',
    streakBadge: (n) => `🔥 ${n}-day streak`,
    viewDeck: 'View deck',

    subjectLabel: 'Subject',
    subjects: { chinese: '🇨🇳 Chinese', english: '🇬🇧 English', math: '🔢 Math' },
    placeholders: {
      chinese: 'e.g. 苹果 or apple',
      english: 'e.g. butterfly',
      math: 'e.g. counting to 10',
    },
    inputHint: 'Type any word she forgot — AI generates the card',
    generate: '✨ Generate Card',
    generating: '✨ Creating magic...',
    recentLabel: 'Recent',

    emptyState: 'Type a word above to generate your first card ✨',
    iKnowIt: '✓ I know it',
    notYet: '✗ Not yet',

    saveToDeck: '+ Save to Deck',
    saved: '✓ Saved',
    hearIt: '🔊 Hear it',
    print: '🖨 Print',

    noCardsYet: 'No cards yet — save your first one!',
    cardCount: (n) => `⭐ ${n} card${n !== 1 ? 's' : ''} saved`,

    deckTitle: (n) => `My Deck (${n})`,
    filterAll: 'All',
    filterLabels: { english: '🇬🇧 English', chinese: '🇨🇳 Chinese', math: '🔢 Math' },
    deckEmpty: 'No cards yet! Ask a grown-up to generate some ✨',
    generateFirst: 'Generate a card',
    filterEmpty: (subject) => `No ${subject} cards yet`,
    clearFilter: 'Clear filter',
    exportDeck: '↓ Export deck (JSON)',
    confirmDelete: 'Delete',
    cancelDelete: 'Cancel',
    close: '✕',

    cardSaved: 'Card saved to deck ✓',

    apiKeyMissing: 'API key not configured — copy .env.example to .env.local and add your key.',
    getKey: 'Get a key →',

    langToggle: '中文',

    // Quiz Mode
    startQuiz: '🎯 Start Quiz',
    quizNeedCards: 'Need at least 5 cards to start a quiz',
    quizSubjectLabel: 'Subject',
    quizCountLabel: 'Questions',
    quizModeLabels: { pronunciation: 'Pronunciation', fillBlank: 'Fill the Blank', wordMeaning: 'Word → Meaning', reading: 'Reading', chineseMeaning: 'Listen → Choose' },
    quizStart: 'Start 🚀',
    quizStartLoading: 'Getting ready...',
    quizProgress: (n, total) => `Question ${n} of ${total}`,
    quizPrompt: {
      pronunciation: 'How do you say this word?',
      fillBlank: 'Pick the missing word:',
      wordMeaning: 'What does this word mean?',
      reading: 'Can you read this character?',
      chineseMeaning: 'Listen and choose the English word:',
    },
    quizHintBtn: '💡 Hint',
    quizSaidIt: 'I said it! ✅',
    quizSkip: 'Not sure 🤔',
    quizKnowIt: 'I can read it! 🗣️',
    quizDontKnow: 'Not sure... 😅',
    quizCorrectBanner: 'Correct! Amazing! 🎉',
    quizWrongBanner: (word) => `Good try! The answer is "${word}"`,
    quizMemoryHelper: '🧠 Memory Helper',
    quizGotIt: 'Got it, next →',
    quizNext: 'Next →',
    quizFinish: 'See Results',
    quizMascotCorrect: ["You're amazing!", 'Keep it up! ⭐', 'So smart!', 'Brilliant! 🌟', 'Great job!'],
    quizMascotWrong: ["Keep going, you've got this!", 'Review this card again 🐼', 'Next time!', 'Practice makes perfect!'],
    quizMascotEmpathy: ["So close! Let's look at this together 👀", "No worries! Let's learn this word 🌱", 'Learning takes time — let\'s go!'],
    quizSummaryTitle: 'Quiz Complete! 🎊',
    quizStars: (n) => `You earned ${n} star${n !== 1 ? 's' : ''}! ⭐`,
    quizScoreMsg: (correct, total) => `${correct} out of ${total} correct`,
    quizScoreLow: 'Keep practicing — you\'ll get there! 💪',
    quizScoreMid: 'Nice work! Keep it up 🌟',
    quizScoreHigh: 'Amazing! You\'re a fast learner! 🏆',
    quizScorePerfect: 'Perfect score! You\'re a superstar! 🥇',
    quizWeakTitle: 'Words to practice more:',
    quizBack: '← Back',
    quizDisable: 'Skip in Quiz',
    quizEnable: 'Include in Quiz',
    quizRestart: 'Try Again 🔄',
    quizRetryFailed: 'Review Missed Cards 🔁',
    quizBackToDeck: 'Back to Deck',
    quizShowCountdown: '⏱️ Countdown',
    quizCountdownOn: 'On',
    quizCountdownOff: 'Off',
    quizTimeUp: "⏰ Time's up!",
    quizSelfPraise: 'Amazing! You said it! 🌟',
    quizRememberIt: "Let's remember it 💡",
    dueForReview: (n) => n > 0 ? `${n} due for review` : '',
  },
};

export function getStrings(lang) {
  return STRINGS[lang] ?? STRINGS[DEFAULT_LANG];
}

export function loadLang() {
  try {
    return localStorage.getItem(LANG_KEY) ?? DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function saveLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // localStorage unavailable (private mode) — silently ignore
  }
}
