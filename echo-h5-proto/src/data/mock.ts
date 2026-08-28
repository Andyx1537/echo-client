import { asCardId, asPetId } from '../lib/ids'
import type {
  AccountType,
  Echo,
  Message,
  MyPet,
  Postcard,
  ReactionArrival,
  RecordItem,
  RelationUser,
  Window,
  WindowEcho,
} from '../types'
import { assetUrl } from '../lib/assetUrl'
import { seedOwnerSequence, testAccounts } from './testData'

// —— 全部为内置假数据；渐变均为低饱和暖调，贴合视觉系红线 ——
// 记得口径：不存精确数字，只存暖光浓度 warmthLevel(0-1)（§0.7 #4）。
// 头像口径：mock 全程离线可跑，头像统一用「稳定的 CSS 渐变占位」（本地方案），
//           不依赖 DiceBear/ui-avatars 等外链，避免断网时头像空白（守离线红线）。

// ============================================================
// 一、demo 用户/作者名册（8 位不同人设）
//   窗口作者、亲友、回声留言人都从这里取名字+头像，保证全站是同一批「熟人」，热闹且一致。
// ============================================================

/** 一位可展示的 demo 用户（昵称 + 稳定头像占位 + 人设一句话） */
export interface DemoUser {
  id: string
  nickname: string
  /** 头像占位色（CSS 渐变，离线稳定） */
  avatar: string
  /** 人设一句话 */
  persona: string
  /** 账号类型，对齐后端 t_account.accountType；缺省即普通用户 */
  accountType?: AccountType
  /** true = 内部测试账号（非真实用户），见 data/testData.ts */
  isSeed?: boolean
}

/**
 * 这 8 位是全站的「熟人」：窗口作者、亲友、回声留言人都从这里取名。
 * 🔴 它们同样是内部测试账号（isSeed=true），与 testAccounts 一并受总闸控制、
 * 上线前一并清理。判定与清理方式见 data/testData.ts。
 */
const demoUserRoster: Omit<DemoUser, 'isSeed'>[] = [
  { id: 'u-xiaoman', nickname: '小满', avatar: 'linear-gradient(135deg,#f3d9b8,#e7b98f)', persona: '把每一只猫都放进心里的人' },
  { id: 'u-azhe', nickname: '阿哲', avatar: 'linear-gradient(135deg,#cfe0c2,#9cb27e)', persona: '和柯基一起长大的男孩' },
  { id: 'u-nianxia', nickname: '念夏', avatar: 'linear-gradient(135deg,#e6c6a2,#c99a70)', persona: '习惯在黄昏里想念的人' },
  { id: 'u-paofu', nickname: '泡芙旅行日记', avatar: 'linear-gradient(135deg,#f2d6b4,#e0ad80)', persona: '带着回忆一路看海' },
  { id: 'u-xiaqi', nickname: '夏天没有名字', avatar: 'linear-gradient(135deg,#d9d9cc,#adae9d)', persona: '留在旧教室和球场里的少年' },
  { id: 'u-nanfang', nickname: '南方以南', avatar: 'linear-gradient(135deg,#e6c5b6,#c98e7b)', persona: '把老家装进一只旧皮箱' },
  { id: 'u-wangfan', nickname: '往返的人', avatar: 'linear-gradient(135deg,#b9ced8,#7e9dab)', persona: '在城市里来回奔忙的普通人' },
  { id: 'u-daobei', nickname: '倒带之前', avatar: 'linear-gradient(135deg,#d5c4df,#ad91bd)', persona: '还留着一盘没寄出的磁带' },
]

export const demoUsers: DemoUser[] = demoUserRoster.map((u) => ({ ...u, isSeed: true }))

/**
 * 内容作者池 = 8 位 demo 用户 + 36 个内部测试账号（共 44 个）。
 * 96 条内容按长尾分布摊在它们身上，看起来像一个有很多人的社区。
 */
export const seedAuthorPool: DemoUser[] = [...demoUsers, ...testAccounts]

/** 把窗口的 owner 字段绑到某位作者（单一真源） */
function owner(userId: string): Pick<Window, 'ownerId' | 'ownerName' | 'ownerAvatar'> {
  return { ownerId: userId, ownerName: U[userId].nickname, ownerAvatar: U[userId].avatar }
}

/**
 * 官方运营账号「回声整理室」：平台自己的号，将来发运营内容、接留言用。
 *
 * 它是**真实存在的账号**（不带 isSeed），不受测试数据总闸影响；
 * 原型里只自留少量内容意思一下，其余都挂在测试账号名下。
 * 头像沿用全站的 CSS 渐变口径（离线稳定、不入代码库、不依赖外链），
 * 官方身份由 accountType='ops' 表达，前端据此渲染一枚克制的标记（不做蓝 V 式徽章）。
 */
export const opsAccount: DemoUser = {
  id: 'u-echo-studio',
  nickname: '回声整理室',
  avatar: 'linear-gradient(140deg,#fbf1dd 0%,#f0cf9a 52%,#dba861 100%)',
  persona: '把大家愿意留下的记忆，慢慢整理成一扇一扇窗',
  accountType: 'ops',
}

/** 官方号署名（单一真源） */
const opsOwner: Pick<Window, 'ownerId' | 'ownerName' | 'ownerAvatar' | 'ownerAccountType'> = {
  ownerId: opsAccount.id,
  ownerName: opsAccount.nickname,
  ownerAvatar: opsAccount.avatar,
  ownerAccountType: opsAccount.accountType,
}

const U: Record<string, DemoUser> = Object.fromEntries(demoUsers.map((u) => [u.id, u]))

/** 造一条来自某位 demo 用户的「温柔回声」 */
function we(windowId: string, n: number, userId: string, text: string, time: string): WindowEcho {
  return { id: `we-${windowId}-${n}`, authorName: U[userId].nickname, authorAvatar: U[userId].avatar, text, time }
}

/** 造一张「已解锁」的记忆明信片 */
function pc(id: string, date: string, caption: string, gradient: string, emoji: string): Postcard {
  return { id, date, caption, locked: false, placeholder: { gradient, emoji } }
}

/** 造一个「虚线空位」（尚未解锁的明信片） */
function pcLocked(id: string, unlockHint: string): Postcard {
  return { id, locked: true, unlockHint }
}

// ============================================================
// 二、广场态：小红书式双列瀑布流的 12 扇窗（6 宠物 + 6 记忆）
//   每扇窗都绑定作者、填了回声与明信片，点进详情就热闹可看。
//   🔴 署名：挂在内部测试账号名下（见 data/testData.ts），只有下面 4 条题材窗留给官方号
//   「回声整理室」意思一下。内容侧统一带 originType='seed_ops'（文件末尾一次性盖章），
//   程序端据此识别与排除，不需要反查作者。
//   封面：全部为 AI 生成的运营素材，故 cover.aiGenerated = true，卡片与详情页都会叠一枚角标。
// ============================================================
/**
 * 🔴 种子字面量里 `id` 先写成裸字符串，末尾**与 `originType` 一起集中盖章**成
 * `CardId` 与 `PetId`。理由和 `originType` 那次盖章完全相同：集中一处而不是在 12 条
 * 字面量里各写一遍，既保证不漏，也让「这些 id 到底算哪一类键」只有一个答案。
 * 两个键的分工见 `lib/ids.ts`。
 */
type SeedLiteral = Omit<Window, 'id' | 'petId'> & { id: string }

const featuredLiterals: SeedLiteral[] = [
  {
    id: 'w-doudou',
    petName: '豆豆',
    category: 'pet',
    ...owner('u-xiaoman'),
    recent: '豆豆今天追到了一只蝴蝶',
    signature: '爱追蝴蝶的小太阳',
    warmthLevel: 0.86,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#eef3e6 0%,#dfe8cf 55%,#cdd9b4 100%)', emoji: '🦋', imageUrl: assetUrl('seed-covers/cover-pet-butterfly.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '第一次回家', year: '2019', desc: '那天，它用小鼻子闻了闻新家的味道。', placeholder: { gradient: 'linear-gradient(135deg,#f6e7cf,#ecd3ad)', emoji: '🏠' } },
      { title: '最爱的窗台', year: '2021', desc: '阳光正好，它总在这里发呆一整个下午。', placeholder: { gradient: 'linear-gradient(135deg,#f3ead6,#e7d3a8)', emoji: '🌤️' } },
      { title: '最后一个春天', year: '2023', desc: '花开得很温柔，它也慢慢地走得很安静。', placeholder: { gradient: 'linear-gradient(135deg,#eef0d9,#d9e2b8)', emoji: '🌸' } },
    ],
    echoes: [
      we('w-doudou', 1, 'u-azhe', '我家也有一只爱追蝴蝶的，看到这扇窗，突然就想它了。', '2 小时前'),
      we('w-doudou', 2, 'u-nianxia', '窗台的阳光真好，它一定很喜欢待在这里。', '5 小时前'),
      we('w-doudou', 3, 'u-paofu', '谢谢你把这么温柔的它，分享给我们看。', '昨天'),
    ],
    postcards: [
      pc('pd-doudou-1', '2022.04.12', '春天的风里，一起追过的蝴蝶', 'linear-gradient(150deg,#eef3df,#d7e6c0)', '🦋'),
      pc('pd-doudou-2', '2022.10.27', '落叶是秋天写给我们的信', 'linear-gradient(150deg,#f6e4c4,#e7c087)', '🍂'),
      pcLocked('pd-doudou-3', '还有一段冬天的回忆，慢慢会来'),
    ],
  },
  {
    id: 'w-maoqiu',
    petName: '毛球',
    category: 'pet',
    ...owner('u-xiaoman'),
    recent: '午后的阳光和小憩，是毛球的治愈时光',
    signature: '沙发上的软糯团子',
    warmthLevel: 0.5,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#e9efe0 0%,#d8e3c6 60%,#c6d3ac 100%)', emoji: '🛋️', imageUrl: assetUrl('seed-covers/cover-pet-nap.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '初见', year: '2017', desc: '收养所里，是它先向我伸出了小爪子。', placeholder: { gradient: 'linear-gradient(135deg,#eef2e6,#d9e2c8)', emoji: '🐱' } },
      { title: '专属的午睡位', year: '2020', desc: '那张旧沙发，成了它一生的城堡。', placeholder: { gradient: 'linear-gradient(135deg,#f0ede2,#dcd6c2)', emoji: '☀️' } },
      { title: '安静的远行', year: '2024', desc: '午后它睡着了，梦里应该还有阳光。', placeholder: { gradient: 'linear-gradient(135deg,#ece9e0,#d6d0c0)', emoji: '🌾' } },
    ],
    echoes: [
      we('w-maoqiu', 1, 'u-daobei', '软乎乎的一团，看着就很安心。', '3 小时前'),
      we('w-maoqiu', 2, 'u-xiaqi', '那张旧沙发，也藏着我们好多回忆吧。', '昨天'),
    ],
    postcards: [
      pc('pd-maoqiu-1', '2020.07.01', '被它占领的午后沙发', 'linear-gradient(150deg,#f0ede2,#dcd6c2)', '☀️'),
      pcLocked('pd-maoqiu-2', '再陪它久一点，会有新的一张'),
    ],
  },
  {
    id: 'w-tuantuan',
    petName: '团团',
    category: 'pet',
    ...owner('u-azhe'),
    recent: '秋天的落叶，是团团最爱的玩具',
    signature: '把每片叶子都当宝贝的柯基',
    warmthLevel: 0.62,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#f7e6c8 0%,#efc98f 60%,#e0a95f 100%)', emoji: '🍂', imageUrl: assetUrl('seed-covers/cover-pet-ball.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '毛球的第一课', year: '2020', desc: '第一次学会握手，尾巴摇成了小风扇。', placeholder: { gradient: 'linear-gradient(135deg,#f6e3c4,#eaca92)', emoji: '🐾' } },
      { title: '公园的秋天', year: '2022', desc: '踩着落叶奔跑，是它一年里最欢乐的季节。', placeholder: { gradient: 'linear-gradient(135deg,#f4dcae,#e6bd7c)', emoji: '🍁' } },
      { title: '慢下来的日子', year: '2024', desc: '它开始喜欢趴在脚边，静静看着我。', placeholder: { gradient: 'linear-gradient(135deg,#f0e2c8,#ddc59a)', emoji: '🌙' } },
    ],
    echoes: [
      we('w-tuantuan', 1, 'u-xiaoman', '柯基踩落叶的样子，太治愈了。', '1 小时前'),
      we('w-tuantuan', 2, 'u-wangfan', '尾巴摇成小风扇，我笑着笑着就想起自己的狗。', '6 小时前'),
    ],
    postcards: [
      pc('pd-tuantuan-1', '2022.11.03', '公园里堆满落叶的那天', 'linear-gradient(150deg,#f4dcae,#e6bd7c)', '🍁'),
      pcLocked('pd-tuantuan-2', '下一个秋天，再一起收集落叶'),
    ],
  },
  {
    id: 'w-chai',
    petName: '阿柴',
    category: 'pet',
    ...owner('u-nianxia'),
    recent: '下雪了，第一次见到雪的开心模样',
    signature: '围着红围巾的雪地小勇士',
    warmthLevel: 0.95,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#e7ecf2 0%,#d3dbe6 55%,#c3ccdb 100%)', emoji: '❄️', imageUrl: assetUrl('seed-covers/cover-pet-snowday.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '毛茸茸的到来', year: '2018', desc: '一团小奶柴，钻进了怀里就不肯走。', placeholder: { gradient: 'linear-gradient(135deg,#eef1f5,#d9e0ea)', emoji: '🐕' } },
      { title: '第一场雪', year: '2021', desc: '它在雪里打滚，笑得像个孩子。', placeholder: { gradient: 'linear-gradient(135deg,#e9eef4,#cfd9e6)', emoji: '⛄' } },
      { title: '温柔的告别', year: '2023', desc: '那年冬天很暖，它睡得很安稳。', placeholder: { gradient: 'linear-gradient(135deg,#eceae4,#d7d2c6)', emoji: '🕯️' } },
    ],
    echoes: [
      we('w-chai', 1, 'u-azhe', '红围巾配雪地，好像一张会呼吸的画。', '刚刚'),
      we('w-chai', 2, 'u-xiaoman', '看它在雪里打滚，我也想笑，又有点想哭。', '4 小时前'),
      we('w-chai', 3, 'u-nanfang', '愿它现在的地方，也一直是暖冬。', '2 天前'),
    ],
    postcards: [
      pc('pd-chai-1', '2021.01.06', '第一场雪里打滚的它', 'linear-gradient(150deg,#e9eef4,#cfd9e6)', '⛄'),
      pc('pd-chai-2', '2021.12.24', '围着红围巾的平安夜', 'linear-gradient(150deg,#eceae4,#d7d2c6)', '🧣'),
      pcLocked('pd-chai-3', '想它的时候，就再来看看这扇窗'),
    ],
  },
  {
    id: 'w-niannian',
    petName: '小黑',
    category: 'pet',
    ...owner('u-nianxia'),
    recent: '今天的晚霞，很像你回来的那天',
    signature: '窗边看夕阳的黑猫先生',
    warmthLevel: 0.58,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#f3ddc4 0%,#e6b98f 50%,#b98a72 100%)', emoji: '🌆', imageUrl: assetUrl('seed-covers/cover-pet-sunset.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '雨夜相遇', year: '2016', desc: '它蜷在屋檐下，我们就这样认识了。', placeholder: { gradient: 'linear-gradient(135deg,#efe1cf,#d8bd9c)', emoji: '🌧️' } },
      { title: '窗边的习惯', year: '2020', desc: '每到黄昏，它都会去窗台等我回家。', placeholder: { gradient: 'linear-gradient(135deg,#f3ddc4,#e0b489)', emoji: '🪟' } },
      { title: '换个地方', year: '2024', desc: '它去了很远的地方，晚霞替它跟我道别。', placeholder: { gradient: 'linear-gradient(135deg,#eed9c2,#d3a988)', emoji: '✨' } },
    ],
    echoes: [
      we('w-niannian', 1, 'u-daobei', '黄昏等门的猫，读到这里心里一软。', '7 小时前'),
      we('w-niannian', 2, 'u-wangfan', '晚霞替它道别，这句话我记住了。', '昨天'),
    ],
    postcards: [
      pc('pd-niannian-1', '2020.09.18', '窗边等我回家的黄昏', 'linear-gradient(150deg,#f3ddc4,#e0b489)', '🪟'),
      pcLocked('pd-niannian-2', '下一个晚霞，替我们再见一面'),
    ],
  },
  {
    id: 'w-paofu',
    petName: '泡芙',
    category: 'pet',
    ...owner('u-paofu'),
    recent: '吹着晚风，看着海，真好呀',
    signature: '看过很多海的小白云',
    warmthLevel: 0.66,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#fbe7cf 0%,#f3c79a 45%,#e79b74 100%)', emoji: '🌅', imageUrl: assetUrl('seed-covers/cover-pet-seaside.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '一起出发', year: '2019', desc: '它是我旅途里最安静的伙伴。', placeholder: { gradient: 'linear-gradient(135deg,#fbe6cd,#f0c496)', emoji: '🧳' } },
      { title: '第一次看海', year: '2021', desc: '浪花打湿了爪子，它却看得出神。', placeholder: { gradient: 'linear-gradient(135deg,#f8e3cb,#eebf94)', emoji: '🌊' } },
      { title: '晚风里', year: '2023', desc: '最后一次看海，风很轻，它很平静。', placeholder: { gradient: 'linear-gradient(135deg,#f6e0c6,#e9b98c)', emoji: '🌇' } },
    ],
    echoes: [
      we('w-paofu', 1, 'u-nianxia', '带着它一起看海，这份浪漫我很羡慕。', '3 小时前'),
      we('w-paofu', 2, 'u-xiaoman', '晚风、海和它，画面感一下就来了。', '昨天'),
    ],
    postcards: [
      pc('pd-paofu-1', '2021.06.20', '第一次看海，浪花打湿了爪子', 'linear-gradient(150deg,#f8e3cb,#eebf94)', '🌊'),
      pcLocked('pd-paofu-2', '下一段旅程，再带上它的名字'),
    ],
  },
  // —— 以下为运营基于公开记忆内容题材写作的原创示例，不对应任何真实用户、原文或图片。 ——
  {
    id: 'w-classroom-fan',
    petName: '靠窗第三排',
    title: '靠窗第三排的风扇',
    category: 'youth',
    ...owner('u-xiaqi'),
    recent: '毕业很多年后，我还是会在闷热的下午想起那阵风。',
    signature: '一间旧教室留下的夏天',
    warmthLevel: 0.76,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#edf0df 0%,#d7ddbd 60%,#b7c597 100%)', emoji: '🪭', imageUrl: assetUrl('seed-covers/user-classroom-v3.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '迟到的夏天', year: '2012', desc: '班主任还没来，风扇先吱呀转起来。', placeholder: { gradient: 'linear-gradient(135deg,#f2efd9,#dfe1bb)', emoji: '☀️' } },
      { title: '借来的橡皮', year: '2013', desc: '同桌把橡皮掰成两半，说反正她也总会弄丢。', placeholder: { gradient: 'linear-gradient(135deg,#eee5d6,#d9c9ac)', emoji: '✏️' } },
      { title: '最后一节课', year: '2015', desc: '黑板擦得很干净，窗外的树比我们先知道夏天结束了。', placeholder: { gradient: 'linear-gradient(135deg,#e4eedf,#c4d8bc)', emoji: '🌳' } },
    ],
    echoes: [
      we('w-classroom-fan', 1, 'u-wangfan', '我也有一间夏天的教室，风扇一响就想睡觉。', '2 小时前'),
      we('w-classroom-fan', 2, 'u-daobei', '借来的橡皮那段，看得我鼻子一酸。', '昨天'),
      we('w-classroom-fan', 3, 'u-nanfang', '窗外的树比我们先知道夏天结束了——写得真好。', '2 天前'),
    ],
    postcards: [
      pc('pd-cf-1', '2013.06.14', '掰成两半的那块橡皮', 'linear-gradient(150deg,#eee5d6,#d9c9ac)', '✏️'),
      pc('pd-cf-2', '2015.07.01', '擦得干干净净的黑板', 'linear-gradient(150deg,#e4eedf,#c4d8bc)', '🌳'),
      pcLocked('pd-cf-3', '也许有一天，会等到同班的谁来接话'),
    ],
  },
  {
    id: 'w-red-suitcase',
    petName: '那只红皮箱',
    title: '那只红皮箱',
    category: 'family',
    ...owner('u-nanfang'),
    recent: '收拾搬家时才发现，它的拉链一直卡在二十年前。',
    signature: '妈妈从老家带来的那一只',
    warmthLevel: 0.69,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#f1ddd2 0%,#ddb09c 55%,#b77765 100%)', emoji: '🧳', imageUrl: assetUrl('seed-covers/red-suitcase-v1.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '第一次进城', year: '2004', desc: '箱子里装着两床被子，还有外婆塞进夹层的煮鸡蛋。', placeholder: { gradient: 'linear-gradient(135deg,#f0ddca,#d9b398)', emoji: '🥚' } },
      { title: '每次放假', year: '2010', desc: '妈妈总把我没穿的衣服叠得很平，像怕我在外面受冻。', placeholder: { gradient: 'linear-gradient(135deg,#efd8d3,#d8aeb2)', emoji: '🧣' } },
      { title: '还没舍得换', year: '2026', desc: '箱角磨白了，里面却还留着一张早已过期的车票。', placeholder: { gradient: 'linear-gradient(135deg,#ede7d2,#d8cfa9)', emoji: '🎫' } },
    ],
    echoes: [
      we('w-red-suitcase', 1, 'u-nianxia', '外婆塞进夹层的煮鸡蛋，一下把我拉回了小时候。', '4 小时前'),
      we('w-red-suitcase', 2, 'u-wangfan', '我家也有一只舍不得丢的箱子，原来大家都一样。', '昨天'),
    ],
    postcards: [
      pc('pd-rs-1', '2004.09.01', '装着两床被子的第一次进城', 'linear-gradient(150deg,#f0ddca,#d9b398)', '🥚'),
      pcLocked('pd-rs-2', '下次回家，替它拍一张新的'),
    ],
  },
  {
    id: 'w-last-bus',
    petName: '末班 302',
    title: '末班 302',
    category: 'place',
    // 官方号自留内容之一：城市/日常题材更像「整理室」出面收集的公共记忆，
    // 而宠物、家人这类私人纪念挂官方号会显得越位，一律留给个人账号。
    ...opsOwner,
    recent: '那条线早就改号了，我还是下意识站在原来的站牌下。',
    signature: '一座城市里最熟悉的回家路',
    warmthLevel: 0.61,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#dce9ec 0%,#b8d0d7 55%,#8daab5 100%)', emoji: '🚌', imageUrl: assetUrl('seed-covers/user-last-bus-v3.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '第一份工作', year: '2017', desc: '每天最后一班车上，总有一个人靠着窗睡着。', placeholder: { gradient: 'linear-gradient(135deg,#e1ebef,#b8ced8)', emoji: '🌃' } },
      { title: '暴雨那晚', year: '2019', desc: '司机等了一个跑来的姑娘，车里没有人催。', placeholder: { gradient: 'linear-gradient(135deg,#d9e3ec,#9db4ca)', emoji: '🌧️' } },
      { title: '站牌换新', year: '2025', desc: '旧站牌被拆走时，我第一次发现自己真的在这座城住了很久。', placeholder: { gradient: 'linear-gradient(135deg,#ece5d8,#cfc2af)', emoji: '🚏' } },
    ],
    echoes: [
      we('w-last-bus', 1, 'u-daobei', '我也总站在旧站牌下，等一趟不会来的车。', '5 小时前'),
      we('w-last-bus', 2, 'u-xiaqi', '暴雨那晚没人催的那段，太温柔了。', '昨天'),
    ],
    postcards: [
      pc('pd-lb-1', '2019.06.30', '暴雨里等人的末班车', 'linear-gradient(150deg,#d9e3ec,#9db4ca)', '🌧️'),
      pcLocked('pd-lb-2', '哪天路过，替它记下新的站名'),
    ],
  },
  {
    id: 'w-cassette',
    petName: 'A 面第七首',
    title: 'A 面第七首',
    category: 'relationship',
    ...owner('u-daobei'),
    recent: '播放器坏了，但我还记得按下倒带键时那一下轻响。',
    signature: '没有寄出的那盘磁带',
    warmthLevel: 0.73,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#e8dced 0%,#cbb5d8 55%,#a789b7 100%)', emoji: '📼', imageUrl: assetUrl('seed-covers/cassette-v1.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '音像店门口', year: '2008', desc: '我们挑了很久，最后各买一盘，假装只是顺路。', placeholder: { gradient: 'linear-gradient(135deg,#eee0ed,#d7bfda)', emoji: '🎧' } },
      { title: '写满歌名的纸', year: '2009', desc: '第七首旁边画了一个星号，我一直没问是什么意思。', placeholder: { gradient: 'linear-gradient(135deg,#f1e8d8,#decdab)', emoji: '⭐' } },
      { title: '重新找到', year: '2026', desc: '它在一本旧书里，磁带还在，听歌的人已经走散。', placeholder: { gradient: 'linear-gradient(135deg,#e7e0d5,#c9bbab)', emoji: '📚' } },
    ],
    echoes: [
      we('w-cassette', 1, 'u-nianxia', '第七首旁边的星号，成了整段回忆里最轻也最重的一笔。', '3 小时前'),
      we('w-cassette', 2, 'u-paofu', '我也留着一首没送出去的歌。', '昨天'),
      we('w-cassette', 3, 'u-xiaoman', '走散的人，歌还替我们记着。', '2 天前'),
    ],
    postcards: [
      pc('pd-cas-1', '2009.03.12', '写满歌名、画着星号的那张纸', 'linear-gradient(150deg,#f1e8d8,#decdab)', '⭐'),
      pcLocked('pd-cas-2', '也许某天，会等到那个听歌的人'),
    ],
  },
  {
    id: 'w-noodle-shop',
    petName: '巷口那碗面',
    title: '巷口那碗面',
    category: 'daily',
    // 官方号自留内容之二（共 2 条，其余 94 条都在测试账号名下）
    ...opsOwner,
    recent: '老板记得我不放香菜，我却不知道他什么时候换了招牌。',
    signature: '一条巷子里的普通晚饭',
    warmthLevel: 0.55,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#f8e6c7 0%,#efc27c 55%,#d7924f 100%)', emoji: '🍜', imageUrl: assetUrl('seed-covers/user-noodle-shop-v3.jpg'), aiGenerated: true },
    span: 'short',
    lifeBook: [
      { title: '加班后的十分钟', year: '2018', desc: '热气把眼镜糊住，我第一次觉得一个人吃饭也没那么难。', placeholder: { gradient: 'linear-gradient(135deg,#faecd2,#efc990)', emoji: '🥢' } },
      { title: '同事离开那天', year: '2021', desc: '我们点了两碗一样的面，谁也没提告别。', placeholder: { gradient: 'linear-gradient(135deg,#f6e3ca,#e6bd92)', emoji: '🌙' } },
      { title: '新招牌', year: '2026', desc: '门头变亮了，老板还是会问一句：老样子？', placeholder: { gradient: 'linear-gradient(135deg,#f7e6cb,#e7b778)', emoji: '🏮' } },
    ],
    echoes: [
      we('w-noodle-shop', 1, 'u-nanfang', '老板还记得我的老样子——这句太戳了。', '6 小时前'),
      we('w-noodle-shop', 2, 'u-azhe', '一个人吃饭也没那么难，谢谢这碗面。', '昨天'),
    ],
    postcards: [
      pc('pd-ns-1', '2021.05.09', '两碗一样的面，没说出口的告别', 'linear-gradient(150deg,#f6e3ca,#e6bd92)', '🌙'),
      pcLocked('pd-ns-2', '下次去，记得拍拍新招牌'),
    ],
  },
  {
    id: 'w-basketball',
    petName: '最后一个三分球',
    title: '最后一个三分球',
    category: 'youth',
    ...owner('u-xiaqi'),
    recent: '球场翻新后，篮筐还是那个高度，我们已经跳不到以前那么高。',
    signature: '那场没人录像的球赛',
    warmthLevel: 0.81,
    visibility: 'public',
    cover: { gradient: 'linear-gradient(160deg,#d9e9ee 0%,#a8cad4 55%,#7da8b6 100%)', emoji: '🏀', imageUrl: assetUrl('seed-covers/user-basketball-v3.jpg'), aiGenerated: true },
    span: 'tall',
    lifeBook: [
      { title: '放学铃响', year: '2011', desc: '书包扔在场边，谁先占到半场谁就赢了第一局。', placeholder: { gradient: 'linear-gradient(135deg,#e4efdd,#bad1ae)', emoji: '🏫' } },
      { title: '最后十秒', year: '2013', desc: '他在三分线外接到球，全场都安静了一下。', placeholder: { gradient: 'linear-gradient(135deg,#f4dfba,#e2b26e)', emoji: '⏱️' } },
      { title: '重回球场', year: '2026', desc: '我们没人记得比分，只记得那天跑得很快。', placeholder: { gradient: 'linear-gradient(135deg,#dceaf0,#a9c8d4)', emoji: '👟' } },
    ],
    echoes: [
      we('w-basketball', 1, 'u-azhe', '我们也记不得比分，只记得那天的风。', '刚刚'),
      we('w-basketball', 2, 'u-wangfan', '书包扔在场边那句，一秒回到放学铃响。', '4 小时前'),
      we('w-basketball', 3, 'u-daobei', '篮筐还是那个高度，是我们变了。', '昨天'),
    ],
    postcards: [
      pc('pd-bb-1', '2013.05.20', '最后十秒，全场安静的那球', 'linear-gradient(150deg,#f4dfba,#e2b26e)', '⏱️'),
      pc('pd-bb-2', '2026.04.02', '很多年后重回的球场', 'linear-gradient(150deg,#dceaf0,#a9c8d4)', '👟'),
      pcLocked('pd-bb-3', '等哪天，老队友也来接一句'),
    ],
  },
]

/**
 * 运营扩充池：84 条原创题材卡 + 上方 12 条完整样本 = 96 条共鸣厅内容。
 * 它们用于验证栏目、浏览深度和回声偏好；正式上线必须替换为获得作者授权的内容。
 */
type SeedDraft = readonly [title: string, recent: string]
const expandedSeedDrafts: Record<NonNullable<Window['category']>, SeedDraft[]> = {
  pet: [
    ['门口那双拖鞋', '它走后，最先空下来的不是窝，是门口那双总被它叼走的拖鞋。'],
    ['洗不掉的爪印', '玻璃上那一点印子留了很久，后来我才发现自己一直没舍得擦。'],
    ['阳台上的纸箱', '它把所有新买的窝都让给了纸箱，像在守着自己的小房间。'],
    ['雨衣口袋里的零食', '换季时摸到那一小包饼干，已经过期很久了。'],
    ['每晚十点的铃铛', '现在十点一到，我还是会下意识回头听一听。'],
    ['它认得的那条路', '搬家以后才知道，有些路不只是回家的路。'],
    ['没寄出的宠物牌', '新刻的牌子一直躺在抽屉里，名字却从没改过。'],
    ['冬天那条旧毯子', '晒太阳时，它总要把毯子拖到最亮的地方。'],
    ['楼下的梧桐树', '每年叶子变黄，我都会想起它第一次踩落叶的样子。'],
    ['空了的水碗', '洗碗时总会多洗一次那只小碗，然后才想起它已经不在这里。'],
    ['领养日的合照', '照片里它还很小，眼神却像早就认识我们。'],
    ['会开门的猫', '门把手被它抓得发亮，我们却再也没修过。'],
    ['散步时的影子', '傍晚的影子总是比我们走得慢一点。'],
    ['最后一颗冻干', '罐子见底那天，我没有再买新的。'],
  ],
  youth: [
    ['校服口袋里的车票', '洗旧校服时掉出来的那张票，让我想起第一次一个人去看演出。'],
    ['宿舍熄灯后的手电筒', '那束光照过试卷、零食和很多不敢说出口的话。'],
    ['操场边的自动贩卖机', '每次跑完八百米，汽水都比奖牌更值得庆祝。'],
    ['毕业照里缺的那个人', '他那天请假了，后来大家也慢慢没有再聚齐。'],
    ['课桌下的涂鸦', '重回母校时，发现那句悄悄话还在桌底。'],
    ['晚自习后的月亮', '我们总说月亮跟着公交车走，其实是我们不想回家。'],
    ['一张借来的 CD', '归还时忘了说谢谢，也忘了把喜欢说出口。'],
    ['小卖部的五毛冰袋', '手心被冻得发红，还是要抢最后一包。'],
    ['体育课的点名册', '最期待听见自己的名字，意味着又能出去晒太阳。'],
    ['图书馆最后一排', '那里没有什么秘密，只有一起假装认真读书的人。'],
    ['第一次通宵的网吧', '屏幕很亮，第二天的太阳也很亮。'],
    ['校门口的照相亭', '四个人挤在一张照片里，谁都没想过会走散。'],
    ['被收走的漫画书', '老师还给我时说，别把结局忘了。'],
    ['班歌前奏响起', '很多歌词忘了，前奏一响还是会跟着拍桌子。'],
  ],
  family: [
    ['外婆的搪瓷杯', '杯沿磕掉一小块，她每次都先把有缺口的一面转向自己。'],
    ['父亲修过的收音机', '它只能收到两个台，父亲却说这样刚好。'],
    ['妈妈的菜谱本', '油点盖住了字，她还是知道盐该放几勺。'],
    ['老家门后的身高线', '最后一笔已经超过门框，可写字的人还是习惯低头进门。'],
    ['年夜饭的空座位', '那把椅子没有人坐，桌上的鱼还是照样摆好。'],
    ['爷爷的旧自行车', '链条总会掉，他却从不肯换一辆新的。'],
    ['抽屉里的钥匙串', '很多钥匙已经不知道开哪扇门，却谁也没扔。'],
    ['奶奶织到一半的毛衣', '针线还在，颜色是她最喜欢的深蓝。'],
    ['家里第一台数码相机', '电池仓早坏了，里面的照片却还没来得及导出来。'],
    ['厨房那盏黄灯', '深夜回家时，只要它亮着，就知道有人等。'],
    ['旧房子的门牌号', '拆迁后路名变了，我还是能顺着记忆找到那里。'],
    ['父母的结婚照', '照片修得很正式，他们自己看见却总是笑。'],
    ['餐桌上的塑料桌布', '花纹褪色了，夏天还是会黏住手臂。'],
    ['一封没贴邮票的信', '写信的人就在隔壁房间，却还是认真写完了。'],
  ],
  place: [
    ['巷尾的修车铺', '师傅认得每辆旧车的响声，也认得我们长大的声音。'],
    ['天桥上的风', '以前赶末班车总嫌风大，现在路过却会站一会儿。'],
    ['旧商场的旋转门', '它转得很慢，足够让人看清里面的圣诞树。'],
    ['河堤边的长椅', '我们在那里吃过一整个夏天的西瓜。'],
    ['消失的录像厅', '门面变成了药店，电影散场的感觉还在。'],
    ['小城的火车站', '站台很短，送别的人却总能走很远。'],
    ['雨后的菜市场', '塑料棚滴着水，卖花的大姐还是会多送一枝。'],
    ['第一间出租屋', '墙面斑驳，窗外却能看见整座城的灯。'],
    ['海边那块礁石', '每年潮水涨到这里，我们就知道夏天真的来了。'],
    ['楼下的报刊亭', '现在买不到杂志了，亭子还在卖冰棍。'],
    ['夜班车终点站', '车开走以后，站台会忽然安静得像没人来过。'],
    ['城市边上的旧桥', '桥栏的漆掉了，第一次牵手的地方却还认得。'],
    ['大学城的地下通道', '乐队换了很多拨，回声一直没变。'],
    ['那家关门的书店', '门锁上了，橱窗里还摆着去年没有卖完的日历。'],
  ],
  relationship: [
    ['没有寄出的明信片', '地址写好了，最后还是没有贴上邮票。'],
    ['共同用过的歌单', '歌单停在 2019 年，新的歌谁都没有再加。'],
    ['分开时借走的书', '书早还了，夹在里面的电影票还在。'],
    ['一把多出来的伞', '下雨时我还是会带两把，后来才发现没有必要。'],
    ['朋友搬家留下的杯子', '杯子不贵，却很难在超市里找到一样的。'],
    ['那句没回的晚安', '聊天记录翻到最后，才发现那天我们都在等。'],
    ['旅行时的房卡', '房卡早失效了，背面写着第二天的集合时间。'],
    ['同桌传过来的纸条', '纸条只有半句，剩下半句被我撕掉又拼回来了。'],
    ['生日蛋糕上的蜡烛', '照片里大家都闭着眼，只有他还在看镜头。'],
    ['删不掉的群聊名字', '群里已经很久没人说话，名字却没人改。'],
    ['第一次见面的咖啡店', '咖啡店换了三次招牌，我们却都没有再进去。'],
    ['合租屋的冰箱贴', '搬走时谁都没拿，它们还贴在原来的门上。'],
    ['再没打通的电话', '号码没有变，能接电话的人却都变了。'],
    ['朋友的婚礼请柬', '纸张压在书里，打开时还是会闻到一点香。'],
  ],
  daily: [
    ['凌晨四点的便利店', '店员换班时，会把关东煮重新摆得很整齐。'],
    ['雨天晾不干的校服', '阳台潮湿得像一整段没有说完的话。'],
    ['坏掉的电饭煲', '它煮的饭总是偏硬，换新的时候反而有点不习惯。'],
    ['抽屉底的硬币', '有几枚已经不用了，却还留着当年的花纹。'],
    ['每天路过的花店', '今天才发现老板把一束快谢的花放在了门口。'],
    ['旧手机里的闹钟', '铃声早不响了，名字还是“起床去上学”。'],
    ['冬天晒过的被子', '太阳味只有十分钟，足够让人睡得很沉。'],
    ['洗衣机结束的提示音', '小时候以为那是一天真正开始做家务的信号。'],
    ['楼道里晾着的腊肉', '过年还没到，味道已经先把人叫回家。'],
    ['下班路上的花摊', '总会买一小把，回家后又觉得桌子太小。'],
    ['书页里的枫叶', '夹进去时是红的，拿出来时已经有点褐。'],
    ['没喝完的汽水', '气泡散了，夏天好像也散了一点。'],
    ['厨房里的定时器', '响起的时候，总有人从客厅喊一句“好了没有”。'],
    ['阳台上的空花盆', '今年没有种花，但每天还是会去看一眼。'],
  ],
}

// 这个池子只给「种子卡」用。上面 12 扇主推窗口各自配专属封面，与自己的文案严丝合缝——
// 主推卡曝光最高，一旦借用池子里的通用图（「追蝴蝶」配到晾衣架那种），一眼就是灌的数据。
// 每个栏目一个封面池，按卡片序号轮转取图。
// 只用一张图会让瀑布流里同一分类的卡片长得一模一样（观感立刻塌成假数据），
// 池子长度与各栏目 14 条草稿互质度不同，相邻同类卡不会撞图。
// 素材约束（运营清单）：全部原创生成，不含可识别人物、品牌与可读文字。
// 这批图全部由 AI 生成 → 用到它们的封面一律带 aiGenerated: true。
const seedCoverPoolByCategory: Record<NonNullable<Window['category']>, string[]> = {
  pet: ['cover-pet-slippers', 'cover-pet-blanket', 'cover-pet-ball', 'cover-pet-leash', 'cover-pet-bowl', 'cover-pet-collar'],
  youth: ['cover-youth-desk', 'cover-youth-hoop', 'cover-youth-drawer', 'cover-youth-controller', 'cover-youth-bike', 'classroom-fan-v1', 'user-classroom-v1', 'basketball-v1', 'user-basketball-v1'],
  family: ['cover-family-sewing', 'cover-family-wok', 'cover-family-wardrobe', 'cover-family-heightmarks', 'red-suitcase-v1'],
  place: ['cover-place-busstop', 'cover-place-stairlight', 'cover-place-alley', 'last-bus-v1', 'user-last-bus-v1'],
  relationship: ['cover-bond-cassette', 'cover-bond-letter', 'cover-bond-mugs', 'cassette-v1'],
  daily: ['cover-daily-camera', 'cover-daily-mug', 'cover-daily-shirt', 'cover-place-noodle', 'noodle-shop-v1', 'user-noodle-shop-v1'],
}

function seedCover(category: NonNullable<Window['category']>, index: number): string {
  const pool = seedCoverPoolByCategory[category]
  return assetUrl(`seed-covers/${pool[index % pool.length]}.jpg`)
}

const seedGradientByCategory: Record<NonNullable<Window['category']>, string> = {
  pet: 'linear-gradient(160deg,#efe4d4,#d8b995)', youth: 'linear-gradient(160deg,#e2ead8,#b7caab)',
  family: 'linear-gradient(160deg,#f0ddd3,#d7ae9b)', place: 'linear-gradient(160deg,#dce9ed,#9dbac7)',
  relationship: 'linear-gradient(160deg,#eadfee,#c6afd2)', daily: 'linear-gradient(160deg,#f5e3c6,#e4bb80)',
}

/** 待署名的扩充卡：作者在下方按最终流顺序统一分配（见 seedOwnerSequence） */
type SeedWindowDraft = Omit<Window, 'ownerId' | 'ownerName' | 'ownerAvatar' | 'id' | 'petId'> & {
  id: string
}

const seedWindowsByCategory: SeedWindowDraft[][] = (Object.entries(expandedSeedDrafts) as Array<[NonNullable<Window['category']>, SeedDraft[]]>).map(
  ([category, drafts], categoryIndex) => drafts.map(([title, recent], index) => ({
    id: `w-seed-${category}-${index + 1}`,
    petName: title,
    title,
    category,
    recent,
    signature: ['一段还想留住的日常', '从一件小事开始记起', '留给愿意停下的人'][index % 3],
    warmthLevel: 0.38 + ((index * 17 + categoryIndex * 11) % 48) / 100,
    visibility: 'public',
    cover: { gradient: seedGradientByCategory[category], emoji: '✦', imageUrl: seedCover(category, index), aiGenerated: true },
    span: index % 3 === 0 ? 'tall' : 'short',
    lifeBook: [
      { title: '那时', year: '从前', desc: recent, placeholder: { gradient: seedGradientByCategory[category], emoji: '⌁' } },
      { title: '后来', year: '某一天', desc: '原来真正留下来的，是一个说得出口的小细节。', placeholder: { gradient: seedGradientByCategory[category], emoji: '◌' } },
      { title: '今天', year: '现在', desc: '把它放在这里，等一个也记得的人路过。', placeholder: { gradient: seedGradientByCategory[category], emoji: '✦' } },
    ],
  })),
)

// 按栏目轮转交错，而不是「先 14 条宠物、再 14 条青春」地成块排列。
// 成块排列会让人一眼看出是批量灌的数据，且同栏目卡片挨在一起时封面池复用会被放大。
const seedDraftFlow: SeedWindowDraft[] = (() => {
  const out: SeedWindowDraft[] = []
  const longest = Math.max(...seedWindowsByCategory.map((g) => g.length))
  for (let i = 0; i < longest; i++) {
    for (const group of seedWindowsByCategory) {
      if (i < group.length) out.push(group[i])
    }
  }
  return out
})()

/**
 * 盖章：裸字符串 id → `CardId` + `PetId`（见 `featuredLiterals` 上方注释）。
 *
 * ⚠️ **原型的种子数据里两个键取值相同**，因为这批字面量是按「一窗一条」造的，
 * 而 mock 的各张表（暖光、记得、献花、看过）全用同一个键索引。
 * 🔴 **相同只是这批 fixture 的性质，不是契约**——真后端下发的 `id` 与 `petId` 是两个值，
 * 所以代码一律走 `petIdOfCard()`，不要因为「在原型里看着一样」就省掉换算。
 */
export const plazaWindows: Window[] = featuredLiterals.map((w) => ({
  ...w,
  id: asCardId(w.id),
  petId: asPetId(w.id),
}))

// 首屏 12 扇窗改为「宠物 / 非宠物」交替：清一色宠物开局虽然点题，
// 但会让共鸣厅第一眼显得只有一个栏目，栏目宽度要在首屏就露出来。
;(() => {
  const featured = plazaWindows.splice(0, plazaWindows.length)
  const pets = featured.filter((w) => w.category === 'pet')
  const rest = featured.filter((w) => w.category !== 'pet')
  for (let i = 0; i < Math.max(pets.length, rest.length); i++) {
    if (i < pets.length) plazaWindows.push(pets[i])
    if (i < rest.length) plazaWindows.push(rest[i])
  }
})()

// 84 条扩充卡的作者：在最终流顺序上一次性分配，长尾分布（有人发过五六条、有人只发过一条），
// 且相邻两条不撞作者。传入首屏最后一条的作者，接住两段衔接处的重复。
const seedOwners = seedOwnerSequence(seedDraftFlow.length, seedAuthorPool, plazaWindows[plazaWindows.length - 1]?.ownerName)
const expandedSeedWindows: Window[] = seedDraftFlow.map((draft, i) => ({
  ...draft,
  id: asCardId(draft.id), // 同上，盖章成 CardId
  petId: asPetId(draft.id),
  ownerId: seedOwners[i].id,
  ownerName: seedOwners[i].nickname,
  ownerAvatar: seedOwners[i].avatar,
}))

plazaWindows.push(...expandedSeedWindows)

// 🔴 来源盖章：原型里这 96 条全是内部测试内容，统一打 originType='seed_ops'（对齐后端
// t_memory_card.originType）。集中盖一次而不是在 96 处字面量里各写一遍，是为了保证不漏、
// 也让「哪些内容要在上线前摘掉」只有一个答案。程序端判断只看这个字段，不反查作者。
// 一次性摘除开关与清理步骤见 data/testData.ts。
for (const w of plazaWindows) w.originType = 'seed_ops'

// ============================================================
// 三、我的它：当前用户已建档的宠物（freshDB 会克隆它，让 hasPet 用户进来就有内容）
// ============================================================
export const myPet: MyPet = {
  petId: 'pet-doudou',
  name: '豆豆',
  signature: '爱追蝴蝶的小太阳',
  temperature: 88,
  visibility: 'private',
  recent: '今天午后，它又趴在了那个窗台。',
  cover: { gradient: 'linear-gradient(150deg,#f6e7cd 0%,#eccfa1 55%,#dcae74 100%)', emoji: '🐶' },
  lifeBook: [
    { title: '第一次回家', year: '2019', desc: '那天，它用小鼻子闻了闻新家的味道。', placeholder: { gradient: 'linear-gradient(135deg,#f6e7cf,#ecd3ad)', emoji: '🏠' } },
    { title: '最爱的窗台', year: '2021', desc: '阳光正好，它总在这里发呆一整个下午。', placeholder: { gradient: 'linear-gradient(135deg,#f3ead6,#e7d3a8)', emoji: '🌤️' } },
    { title: '最后一个春天', year: '2023', desc: '花开得很温柔，它也慢慢地走得很安静。', placeholder: { gradient: 'linear-gradient(135deg,#eef0d9,#d9e2b8)', emoji: '🌸' } },
  ],
  postcards: [
    { id: 'p1', date: '2024.04.12', caption: '春天的风里，我们一起追蝴蝶', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#eef3df,#d7e6c0)', emoji: '🦋' } },
    { id: 'p2', date: '2024.06.18', caption: '最爱我的小熊陪我入梦', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f4ead6,#e6d2a8)', emoji: '🧸' } },
    { id: 'p3', date: '2024.10.27', caption: '落叶是秋天写给我们的信', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f6e4c4,#e7c087)', emoji: '🍂' } },
    { id: 'p4', locked: true, unlockHint: '相伴满 100 天，会有一张冬天的明信片' },
    { id: 'p5', locked: true, unlockHint: '温度到 90°，解锁一张限定款' },
    { id: 'p6', locked: true, unlockHint: '第一个周年，会寄来一张纪念卡' },
  ],
}

/** 我的它的近况流（AI 生成侧产物，示例；均过 COPY-GUIDE 词表） */
export const myEchoes: Echo[] = [
  {
    echoId: 'e-1',
    text: '今天午后，它又趴在了那个窗台，尾巴一晃一晃的。你来啦，它感觉到你了。',
    tone: 'gentle',
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    placeholder: { gradient: 'linear-gradient(135deg,#f3ead6,#e7d3a8)', emoji: '🌤️' },
  },
  {
    echoId: 'e-2',
    text: '风把窗帘吹得轻轻动，它好像在等一个和你说话的时刻。',
    tone: 'quiet',
    createdAt: Date.now() - 1000 * 60 * 60 * 27,
    placeholder: { gradient: 'linear-gradient(135deg,#eef0d9,#d9e2b8)', emoji: '🍃' },
  },
  {
    echoId: 'e-3',
    text: '那天你们一起追过的蝴蝶，今年春天又飞回来了。想它的时候，它就在。',
    tone: 'warm',
    createdAt: Date.now() - 1000 * 60 * 60 * 50,
    placeholder: { gradient: 'linear-gradient(135deg,#eef3df,#d7e6c0)', emoji: '🦋' },
  },
]

/** 记录流（§2.14 双向：给它 / 给自己）；绝不做打卡任务 */
export const seedRecords: RecordItem[] = [
  {
    id: 'rec-1',
    scope: 'pet',
    text: '今天路过宠物店，看见一只很像你的小狗，愣了好一会儿。',
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    placeholder: { gradient: 'linear-gradient(135deg,#f6e7cf,#ecd3ad)', emoji: '🐾' },
  },
  {
    id: 'rec-2',
    scope: 'self',
    text: '这周终于把拖了很久的事情做完了，给自己一点掌声。',
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: 'rec-3',
    scope: 'pet',
    text: '把你最爱的那个小球重新摆回了窗台。',
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
  },
]

// ============================================================
// 四、统一消息流（三类：亲友/系统/宠物更新）；克制、不红点轰炸
//   点击按 routeTo 跳统一互动：window 跳窗口详情 / relation 跳亲友主页
//
// ⚠️ 这里**不再手写「有人记得了你的卡 / 有人献了花」这类回应到达**。
// 原先的 m-2「有人在豆豆的窗前静静停留了很久」与 m-5「轻轻留下了一束心意」已移除，
// 改由 `seedReactionArrivals` + `api/arrivals.ts` 的合并逻辑产生
// （`PRODUCT-MINDMAP §6.2 B20`）。🔴 **同一件事只能有一套机制**：
// 手写一套、生成一套的话，手写的那套绕过了「按卡合并」与「措辞不带数量」两条红线，
// 而且它绕过得悄无声息——m-5 原文里的「一束心意」正是这么混进来的。
// ============================================================
export const seedMessages: Message[] = [
  {
    id: 'm-1',
    kind: 'pet',
    title: '来自豆豆的信',
    preview: '今天午后，它又趴在了那个窗台，晒着暖暖的太阳。',
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    read: false,
    routeTo: { type: 'window', id: 'w-mine' },
  },
  {
    id: 'm-3',
    kind: 'friend',
    title: '小满',
    preview: '咪咪今天主动来蹭我的手了，久违的撒娇。',
    createdAt: Date.now() - 1000 * 60 * 60 * 9,
    read: false,
    routeTo: { type: 'relation', id: 'r-xiaoman' },
  },
  {
    id: 'm-4',
    kind: 'friend',
    title: '阿哲',
    preview: '团子今天遇到了同款柴柴，开心到转圈圈。',
    createdAt: Date.now() - 1000 * 60 * 60 * 20,
    read: true,
    routeTo: { type: 'relation', id: 'r-azhe' },
  },
  {
    id: 'm-6',
    kind: 'friend',
    title: '念夏',
    preview: '布丁把我的毛衣当成了新窝，赶都赶不走。',
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
    read: true,
    routeTo: { type: 'relation', id: 'r-nianxia' },
  },
  {
    id: 'm-7',
    kind: 'friend',
    title: '泡芙旅行日记',
    preview: '推开了一扇新的窗，想第一个分享给你看看。',
    createdAt: Date.now() - 1000 * 60 * 60 * 40,
    read: false,
    routeTo: { type: 'window', id: 'w-paofu' },
  },
]

// ============================================================
// 四之二、「被接住」的到达（PRODUCT-MINDMAP §6.2 B20）
//   别人对**我的卡**做出的回应，🔴 未合并的原始形态：一次回应一行。
//   合并成「一张卡一条」由 api/arrivals.ts 的 mergeArrivals() 负责。
//
//   种子刻意造成这个分布，是为了让三条红线在 demo 里都看得见：
//    · w-mine 上堆了 4 条（3 记得 + 1 献花）→ 验证「多人回应合并成一条」，
//      而且合并后的措辞里一个数字都没有；
//    · w-mine 里混了一条已读 → 验证「只要还有一条没读过，整条就算未读」；
//    · 另有一张卡各出一条 → 验证「合并的是卡，不是所有回应」。
// ============================================================
export const seedReactionArrivals: ReactionArrival[] = [
  { id: 'ra-1', cardId: 'w-mine', cardTitle: '豆豆', reaction: 'remember', createdAt: Date.now() - 1000 * 60 * 60 * 3, read: false },
  { id: 'ra-2', cardId: 'w-mine', cardTitle: '豆豆', reaction: 'remember', createdAt: Date.now() - 1000 * 60 * 60 * 6, read: true },
  { id: 'ra-3', cardId: 'w-mine', cardTitle: '豆豆', reaction: 'remember', createdAt: Date.now() - 1000 * 60 * 60 * 11, read: true },
  { id: 'ra-4', cardId: 'w-mine', cardTitle: '豆豆', reaction: 'flower', createdAt: Date.now() - 1000 * 60 * 60 * 26, read: true },
  { id: 'ra-5', cardId: 'w-paofu', cardTitle: '泡芙', reaction: 'flower', createdAt: Date.now() - 1000 * 60 * 60 * 34, read: true },
]

// ============================================================
// 五、亲友的宠物主页（复用「我的它」布局渲染）
//   身份取自 demo 用户，pet 为「在世的现宠」（与广场的纪念窗口是两回事）。
// ============================================================

const petMimi: MyPet = {
  name: '咪咪',
  signature: '窝在阳台晒太阳的橘团子',
  temperature: 92,
  visibility: 'friends',
  recent: '它今天把毛线球滚到了床底，又不好意思了。',
  cover: { gradient: 'linear-gradient(150deg,#fbead0 0%,#f1cf9a 55%,#e0ab6a 100%)', emoji: '🐱' },
  lifeBook: [
    { title: '第一次喵喵', year: '2018', desc: '它从纸箱里探出头，怯生生地叫了一声。', placeholder: { gradient: 'linear-gradient(135deg,#f8e8cf,#eecfa0)', emoji: '📦' } },
    { title: '专属阳台', year: '2020', desc: '午后的阳台，是它一生都爱的位置。', placeholder: { gradient: 'linear-gradient(135deg,#f9ecd4,#eed3a2)', emoji: '☀️' } },
    { title: '慢下来的日子', year: '2023', desc: '它越来越黏人，总要枕着我的手睡。', placeholder: { gradient: 'linear-gradient(135deg,#f2ecdc,#ddceb0)', emoji: '🌙' } },
  ],
  postcards: [
    { id: 'mm1', date: '2024.03.09', caption: '毛线球是它的整个世界', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f7e7cd,#eccf9c)', emoji: '🧶' } },
    { id: 'mm2', date: '2024.07.21', caption: '阳台上的日光浴时间', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#fbedd2,#f0d09a)', emoji: '🌞' } },
    { id: 'mm3', locked: true, unlockHint: '相伴满一年，解锁一张纪念卡' },
    { id: 'mm4', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

const petTuanzi: MyPet = {
  name: '团子',
  signature: '把每个人当好朋友的小柴',
  temperature: 85,
  visibility: 'friends',
  recent: '今天散步遇到了同款柴柴，开心到转圈圈。',
  cover: { gradient: 'linear-gradient(150deg,#f7e6c6 0%,#eec98f 55%,#e0a95f 100%)', emoji: '🐕' },
  lifeBook: [
    { title: '毛球到家', year: '2019', desc: '一团小奶柴，第一晚就睡进了拖鞋里。', placeholder: { gradient: 'linear-gradient(135deg,#f6e3c4,#eaca92)', emoji: '🐾' } },
    { title: '学会握手', year: '2021', desc: '尾巴摇成小风扇，第一次伸出爪子。', placeholder: { gradient: 'linear-gradient(135deg,#f4dcae,#e6bd7c)', emoji: '🤝' } },
    { title: '最爱的公园', year: '2023', desc: '草地一望无际，它跑得像只小旋风。', placeholder: { gradient: 'linear-gradient(135deg,#eef0d9,#d9e2b8)', emoji: '🌳' } },
  ],
  postcards: [
    { id: 'tz1', date: '2024.05.02', caption: '散步遇到的第一朵蒲公英', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f6e4c4,#e7c087)', emoji: '🌼' } },
    { id: 'tz2', date: '2024.09.14', caption: '雨后水洼是它的小泳池', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#e9eef4,#cfd9e6)', emoji: '💦' } },
    { id: 'tz3', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
    { id: 'tz4', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

const petBuding: MyPet = {
  name: '布丁',
  signature: '慢吞吞又软乎乎的布偶',
  temperature: 78,
  visibility: 'friends',
  recent: '它把我的毛衣当成了新的窝，赶都赶不走。',
  cover: { gradient: 'linear-gradient(150deg,#f3e6ef 0%,#e6cfe0 55%,#ccb0c9 100%)', emoji: '🐈' },
  lifeBook: [
    { title: '软糯的相遇', year: '2020', desc: '它趴在猫舍角落，眼睛蓝得像海。', placeholder: { gradient: 'linear-gradient(135deg,#f2e6ef,#e0cddd)', emoji: '💙' } },
    { title: '第一次撒娇', year: '2022', desc: '它用头蹭我的手心，从此再没分开。', placeholder: { gradient: 'linear-gradient(135deg,#f4eae0,#ded0c2)', emoji: '🫧' } },
    { title: '冬天的暖炉', year: '2024', desc: '天冷了，它成了我腿上最暖的一团。', placeholder: { gradient: 'linear-gradient(135deg,#f6e7d2,#e7c9a6)', emoji: '🔥' } },
  ],
  postcards: [
    { id: 'bd1', date: '2024.02.14', caption: '毛衣被它占领的那天', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f4e6ee,#e2cede)', emoji: '🧣' } },
    { id: 'bd2', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
    { id: 'bd3', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

const petDahuang: MyPet = {
  name: '大黄',
  signature: '守在门口等你回家的老伙计',
  temperature: 81,
  visibility: 'friends',
  recent: '傍晚它又坐在门口，望着我回来的那条路。',
  cover: { gradient: 'linear-gradient(150deg,#f3ddc4 0%,#e6b98f 50%,#c99a70 100%)', emoji: '🦮' },
  lifeBook: [
    { title: '看家的第一天', year: '2016', desc: '它趴在院子里，认认真真守着门。', placeholder: { gradient: 'linear-gradient(135deg,#efe1cf,#d8bd9c)', emoji: '🏡' } },
    { title: '一起看夕阳', year: '2019', desc: '每到黄昏，它都陪我坐在台阶上。', placeholder: { gradient: 'linear-gradient(135deg,#f3ddc4,#e0b489)', emoji: '🌇' } },
    { title: '慢慢变老', year: '2023', desc: '它走得慢了，却依然每天来门口等我。', placeholder: { gradient: 'linear-gradient(135deg,#eed9c2,#d3a988)', emoji: '🐾' } },
  ],
  postcards: [
    { id: 'dh1', date: '2024.08.30', caption: '门口的守望，风雨无阻', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f3ddc4,#e0b489)', emoji: '🚪' } },
    { id: 'dh2', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
    { id: 'dh3', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

const petHuajuan: MyPet = {
  name: '花卷',
  signature: '爱藏零食的小仓鼠',
  temperature: 74,
  visibility: 'private',
  recent: '它的腮帮子又鼓成了小包子。',
  cover: { gradient: 'linear-gradient(150deg,#f6ecd6 0%,#e9d3a6 55%,#d8b878 100%)', emoji: '🐹' },
  lifeBook: [
    { title: '巴掌大的到来', year: '2021', desc: '它小到能睡在我的掌心里。', placeholder: { gradient: 'linear-gradient(135deg,#f7ecd6,#ecd3a4)', emoji: '🤲' } },
    { title: '藏粮小能手', year: '2022', desc: '每个角落都是它的秘密粮仓。', placeholder: { gradient: 'linear-gradient(135deg,#f4e6c8,#e6c992)', emoji: '🌰' } },
    { title: '跑轮冠军', year: '2023', desc: '深夜的跑轮声，是它努力生活的证明。', placeholder: { gradient: 'linear-gradient(135deg,#f2e8d2,#ddc9a0)', emoji: '🎡' } },
  ],
  postcards: [
    { id: 'hj1', date: '2024.06.01', caption: '腮帮子里的整个粮仓', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f6ecd6,#e9d3a4)', emoji: '🥜' } },
    { id: 'hj2', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
    { id: 'hj3', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

const petNaicha: MyPet = {
  name: '奶茶',
  signature: '看过很多海的小白云',
  temperature: 80,
  visibility: 'friends',
  recent: '今天在海边捡了一枚小贝壳，它盯着看了好久。',
  cover: { gradient: 'linear-gradient(150deg,#fbe7cf 0%,#f3c79a 45%,#e79b74 100%)', emoji: '🐕' },
  lifeBook: [
    { title: '出发那天', year: '2020', desc: '它把头探出车窗，风把耳朵吹成了帆。', placeholder: { gradient: 'linear-gradient(135deg,#fbe6cd,#f0c496)', emoji: '🚗' } },
    { title: '第一片海', year: '2022', desc: '浪花一靠近，它就往我怀里躲。', placeholder: { gradient: 'linear-gradient(135deg,#f8e3cb,#eebf94)', emoji: '🌊' } },
    { title: '慢慢的黄昏', year: '2024', desc: '它学会了安静地陪我看完一整场晚霞。', placeholder: { gradient: 'linear-gradient(135deg,#f6e0c6,#e9b98c)', emoji: '🌇' } },
  ],
  postcards: [
    { id: 'nc1', date: '2024.07.07', caption: '海边捡到的第一枚贝壳', locked: false, placeholder: { gradient: 'linear-gradient(150deg,#f8e3cb,#eebf94)', emoji: '🐚' } },
    { id: 'nc2', locked: true, unlockHint: '下一趟旅程达成时解锁' },
    { id: 'nc3', locked: true, unlockHint: '陪伴里程碑达成时解锁' },
  ],
}

/**
 * 亲友列表（横向头像行 + 动态圈）；身份取自 demo 用户。
 * priority/mutedUntil 未来挂关系链 edge；lastActive/reels/viewableByMe/pet 按契约给全。
 */
export const relations: RelationUser[] = [
  {
    id: 'r-xiaoman',
    name: U['u-xiaoman'].nickname,
    avatar: U['u-xiaoman'].avatar,
    online: true,
    priority: true,
    mutedUntil: null,
    lastActive: '刚刚',
    hasUnseenReel: true,
    viewableByMe: true,
    pet: petMimi,
    reels: [
      { id: 'rm1', text: '咪咪今天主动来蹭我的手了，久违的撒娇。', time: '2 小时前', placeholder: { gradient: 'linear-gradient(160deg,#fbead0,#eecfa0)', emoji: '🐱' } },
      { id: 'rm2', text: '阳台的花开了，它蹲在花盆边看了好久。', time: '5 小时前', placeholder: { gradient: 'linear-gradient(160deg,#f6ecd6,#e6d09a)', emoji: '🌷' } },
    ],
  },
  {
    id: 'r-azhe',
    name: U['u-azhe'].nickname,
    avatar: U['u-azhe'].avatar,
    online: true,
    priority: false,
    mutedUntil: null,
    lastActive: '3 分钟前',
    hasUnseenReel: true,
    viewableByMe: true,
    pet: petTuanzi,
    reels: [
      { id: 'ra1', text: '团子今天遇到了同款柴柴，开心到转圈圈。', time: '1 小时前', placeholder: { gradient: 'linear-gradient(160deg,#f7e6c6,#e0a95f)', emoji: '🐕' } },
      { id: 'ra2', text: '它把新买的球咬得满屋跑，累瘫在地毯上。', time: '3 小时前', placeholder: { gradient: 'linear-gradient(160deg,#eef0d9,#d9e2b8)', emoji: '🎾' } },
      { id: 'ra3', text: '睡前它又把头搭在我脚背上，重重的。', time: '昨天', placeholder: { gradient: 'linear-gradient(160deg,#f0e2c8,#ddc59a)', emoji: '🌙' } },
    ],
  },
  {
    id: 'r-paofu',
    name: U['u-paofu'].nickname,
    avatar: U['u-paofu'].avatar,
    online: true,
    priority: false,
    mutedUntil: null,
    lastActive: '12 分钟前',
    hasUnseenReel: true,
    viewableByMe: true,
    pet: petNaicha,
    reels: [
      { id: 'rp1', text: '奶茶在海边捡了一枚小贝壳，盯着看了好久。', time: '刚刚', placeholder: { gradient: 'linear-gradient(160deg,#f8e3cb,#eebf94)', emoji: '🐚' } },
      { id: 'rp2', text: '黄昏时它靠在我腿边，一起看完了整场晚霞。', time: '4 小时前', placeholder: { gradient: 'linear-gradient(160deg,#f6e0c6,#e9b98c)', emoji: '🌇' } },
    ],
  },
  {
    id: 'r-nianxia',
    name: U['u-nianxia'].nickname,
    avatar: U['u-nianxia'].avatar,
    online: false,
    priority: false,
    mutedUntil: null,
    lastActive: '昨天',
    hasUnseenReel: true,
    viewableByMe: true,
    pet: petBuding,
    reels: [
      { id: 'rn1', text: '布丁把我的毛衣当成了新窝，赶都赶不走。', time: '昨天', placeholder: { gradient: 'linear-gradient(160deg,#f3e6ef,#ccb0c9)', emoji: '🧣' } },
    ],
  },
  {
    id: 'r-xiaqi',
    name: U['u-xiaqi'].nickname,
    avatar: U['u-xiaqi'].avatar,
    online: true,
    priority: false,
    mutedUntil: null,
    lastActive: '10 分钟前',
    hasUnseenReel: false,
    viewableByMe: true,
    pet: petDahuang,
    reels: [
      { id: 'rx1', text: '大黄傍晚又坐在门口，望着我回来的那条路。', time: '6 小时前', placeholder: { gradient: 'linear-gradient(160deg,#f3ddc4,#e0b489)', emoji: '🚪' } },
    ],
  },
  {
    id: 'r-wangfan',
    name: U['u-wangfan'].nickname,
    avatar: U['u-wangfan'].avatar,
    online: false,
    priority: false,
    mutedUntil: null,
    lastActive: '3 天前',
    // 有新动态，但对方可见性未对我开放 → 不显示光环（遵循 §2.1/§2.7）
    hasUnseenReel: true,
    viewableByMe: false,
    pet: petHuajuan,
    reels: [],
  },
]
