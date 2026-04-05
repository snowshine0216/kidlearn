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
  },
};

export function getStrings(lang) {
  return STRINGS[lang] ?? STRINGS[DEFAULT_LANG];
}

export function loadLang() {
  return localStorage.getItem(LANG_KEY) ?? DEFAULT_LANG;
}

export function saveLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
}
