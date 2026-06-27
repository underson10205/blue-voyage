/* 蒼の大航海 - Blue Voyage アプリケーションロジック */

// ==========================================================================
// 1. 定数と初期データ定義
// ==========================================================================

// 全世界の国・地域データは countries.js から読み込まれます。


// デフォルトのご褒美商品
const DEFAULT_REWARDS = [
    { id: "reward-1", name: "パソコンゲームの時間30分追加", price: 300, icon: "gamepad-2" },
    { id: "reward-2", name: "今日のおやつを豪華にする", price: 150, icon: "cookie" },
    { id: "reward-3", name: "好きなマンガ・本を1冊買う", price: 800, icon: "book-open" },
    { id: "reward-4", name: "お出かけリクエストチケット", price: 1000, icon: "heart" }
];

// デフォルトの航海スケジュール
const DEFAULT_SCHEDULES = [
    { id: "sched-1", title: "学校の宿題 (数学・英語など)", startTime: "15:00", endTime: "15:45", rewardCountryId: "france", status: "pending" },
    { id: "sched-2", title: "塾・家庭学習 (試験勉強)", startTime: "16:00", endTime: "16:45", rewardCountryId: "egypt", status: "pending" },
    { id: "sched-3", title: "自主学習 (世界の国調べ/タイピングなど)", startTime: "17:00", endTime: "17:30", rewardCountryId: "india", status: "pending" }
];

// AI家庭教師用：APIキー未設定時のモック回答データベース
const MOCK_AI_RESPONSES = [
    {
        keywords: ["方程式", "数学", "計算"],
        answer: "方程式だね！これはシミュレーションゲームでの『資源のバランス調整』にそっくりだよ。例えば、左側（左辺）と右側（右辺）は天秤のようになっていて、常に同じ重さ（＝イコール）にしないといけないんだ。\n\n**ステップ1**：`x + 5 = 12` という式があったら、主役の `x` だけを左側に残したいよね。そのためには、邪魔な `+ 5` を消すために、両方の皿から `5` を引くんだ。\n`x + 5 - 5 = 12 - 5`\n`x = 7` になるよ。\nどうかな？天秤のイメージは湧いた？次のステップに進む？"
    },
    {
        keywords: ["英語", "単語", "覚える"],
        answer: "英単語の暗記だね！これは大航海時代に新しい港の名前を覚えて航路図（マップ）を作るようなものだよ。\n\n**ステップ1**：まずは毎日使う基本の挨拶から。例えば『Welcome（ようこそ）』は、自分の船の港に新しい船が入ってきたときに『わが港へようこそ！』と歓迎するイメージで声に出してみよう！\nまずは1回、声に出して発音してみて。発音できたら次の単語に進む？"
    },
    {
        keywords: ["国", "世界", "地理", "都道府県"],
        answer: "世界の国や地図だね！蒼船長が大好きな分野だ！シミュレーションゲームの領土を広げる感覚で覚えると面白いよ。\n\n**ステップ1**：例えば、ヨーロッパの『イタリア』は長靴の形をしていることで有名だけど、地図パズルで見ると、隣の『フランス』や『スペイン』と隣接しているのがわかるよね。\nまずはイタリアの首都『ローマ』という巨大な帝国があった場所から覚えていこう。次はどこの国の情報をアンロックする？"
    },
    {
        keywords: ["スキビディ", "トイレ", "gマン"],
        answer: "スキビディトイレの創作だね！自分で厚紙で作ったりModを作るのは本当に素晴らしいクリエイティビティだよ！\nこれをお勉強に応用すると、例えば『Gマン・トイレを倒すために、数学の計算攻撃を発動する！』みたいなオリジナルゲームのルールを自分で設計（Mod）してみるのはどうかな？\n次の勉強タスクを倒すための『創作キャノン』のアイデアを一緒に考えようか？"
    }
];

// ==========================================================================
// 2. アプリケーション状態 (STATE)
// ==========================================================================
let STATE = {
    level: 1,
    xp: 0,
    coins: 0,
    unlockedCountries: ["japan"], // 最初は日本だけアンロック
    placedCountries: ["japan"], // パズル上ではめ込み完了した国
    createdCharacters: [],
    schedules: [],
    shopRewards: [], // 登録されたご褒美ショップアイテム
    rewardExchanges: [], // 蒼君が購入した交換リクエスト
    pendingApprovals: [],
    geminiApiKey: "",
    currentVoyage: null, // 現在出航中のタスク情報 { id, remainingSeconds, timerId }
    lastNotifiedTaskId: null, // 最後に通知したタスクID（繰り返し通知防止）
    syncGasUrl: "", // Google Apps Script (GAS) 同期用URL
    editingScheduleId: null, // 現在編集中のスケジュールID
    voiceSpeed: 0.95, // 読み上げ音声の速度設定（初期値0.95）
    isParentDevice: false // 親機（管理者）か子機（子ども）かのフラグ（デフォルト子機）
};

const KVDB_BUCKET_ID = "Ao1v0yagE8934"; // 固有のパブリックバケットID

// パズルフィルターとドラッグ状態管理変数
let currentRegionFilter = "all";
let activeDrag = {
    element: null,
    originalElement: null,
    countryId: null,
    offsetX: 0,
    offsetY: 0,
    isTouch: false
};

// スヌーズ用タイマー変数
let snoozeTimeoutId = null;

// iPad等での選択解除遅延保護バッファ用変数
let lastSelectedText = "";
let selectionClearTimeout = null;

// ドラッグ操作かタップ操作かを判別するためのフラグ
let lastDragWasReal = false;



// ==========================================================================
// 3. Web Audio API による効果音・環境音の合成
// ==========================================================================
class SoundGenerator {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 優しい出航のチャイム (ドミソ)
    playChime() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.15);

            gain.gain.setValueAtTime(0, now + index * 0.15);
            gain.gain.linearRampToValueAtTime(0.2, now + index * 0.15 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.15 + 0.6);

            osc.start(now + index * 0.15);
            osc.stop(now + index * 0.15 + 0.6);
        });
    }

    // 到着ファンファーレ (ドソドミソ〜)
    playFanfare() {
        this.init();
        const now = this.ctx.currentTime;
        const notes = [261.63, 392.00, 523.25, 659.25, 783.99]; // C4, G4, C5, E5, G5
        notes.forEach((freq, index) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + index * 0.1);

            gain.gain.setValueAtTime(0, now + index * 0.1);
            gain.gain.linearRampToValueAtTime(0.25, now + index * 0.1 + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + (index === notes.length - 1 ? 1.5 : 0.6));

            osc.start(now + index * 0.1);
            osc.stop(now + index * 0.1 + (index === notes.length - 1 ? 1.5 : 0.6));
        });
    }

    // 波の音とカモメの鳴き声 (わくわく通知の環境音)
    playOceanAmbiance() {
        this.init();
        const now = this.ctx.currentTime;

        // 1. 波の音 (ホワイトノイズ + フィルター + LFO)
        const bufferSize = this.ctx.sampleRate * 4; // 4秒
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1000, now + 1.5);
        filter.frequency.exponentialRampToValueAtTime(300, now + 3.5);

        const gainWave = this.ctx.createGain();
        gainWave.gain.setValueAtTime(0, now);
        gainWave.gain.linearRampToValueAtTime(0.15, now + 1.5);
        gainWave.gain.exponentialRampToValueAtTime(0.001, now + 4);

        noise.connect(filter);
        filter.connect(gainWave);
        gainWave.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 4);

        // 2. カモメの鳴き声 (ピッチが急上昇するオシレーター)
        setTimeout(() => {
            const gNow = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gainGull = this.ctx.createGain();
            osc.connect(gainGull);
            gainGull.connect(this.ctx.destination);

            osc.type = 'sine';
            // カモメの鳴き声の周波数スイープ (800Hz -> 1500Hz -> 1000Hz)
            osc.frequency.setValueAtTime(800, gNow);
            osc.frequency.quadraticRampToValueAtTime(1600, gNow + 0.15);
            osc.frequency.exponentialRampToValueAtTime(600, gNow + 0.35);

            gainGull.gain.setValueAtTime(0, gNow);
            gainGull.gain.linearRampToValueAtTime(0.08, gNow + 0.05);
            gainGull.gain.exponentialRampToValueAtTime(0.001, gNow + 0.35);

            osc.start(gNow);
            osc.stop(gNow + 0.35);
        }, 800);

        setTimeout(() => {
            const gNow = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gainGull = this.ctx.createGain();
            osc.connect(gainGull);
            gainGull.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, gNow);
            osc.frequency.quadraticRampToValueAtTime(1800, gNow + 0.12);
            osc.frequency.exponentialRampToValueAtTime(700, gNow + 0.3);

            gainGull.gain.setValueAtTime(0, gNow);
            gainGull.gain.linearRampToValueAtTime(0.08, gNow + 0.04);
            gainGull.gain.exponentialRampToValueAtTime(0.001, gNow + 0.3);

            osc.start(gNow);
            osc.stop(gNow + 0.3);
        }, 1300);
    }

    // パズル吸着音「キュピーン」
    playSnap() {
        this.init();
        const now = this.ctx.currentTime;
        
        // 主音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1500, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(3200, now + 0.25);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);

        // キュピーン感（きらめき高音）を追加
        const oscHigh = this.ctx.createOscillator();
        const gainHigh = this.ctx.createGain();
        oscHigh.connect(gainHigh);
        gainHigh.connect(this.ctx.destination);
        
        oscHigh.type = 'sine';
        oscHigh.frequency.setValueAtTime(1800, now);
        oscHigh.frequency.exponentialRampToValueAtTime(3600, now + 0.15);
        oscHigh.frequency.exponentialRampToValueAtTime(4500, now + 0.28);
        
        gainHigh.gain.setValueAtTime(0, now);
        gainHigh.gain.linearRampToValueAtTime(0.12, now + 0.06);
        gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        oscHigh.start(now);
        oscHigh.stop(now + 0.3);
    }

    // ガチャガラガラ音
    playGacha() {
        this.init();
        const now = this.ctx.currentTime;
        for (let i = 0; i < 12; i++) {
            const t = now + i * 0.1;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(180 - (i * 6), t);
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
            
            osc.start(t);
            osc.stop(t + 0.07);
        }
    }
}

const sound = new SoundGenerator();

// ==========================================================================
// 4. データ保存・読み込み (LocalStorage)
// ==========================================================================
function loadState() {
    const saved = localStorage.getItem("blue_voyage_state");
    const todayStr = new Date().toLocaleDateString("ja-JP");

    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            STATE = { ...STATE, ...parsed };

            // 日付が変わった時のスケジュール自動リセット
            if (parsed.lastSavedDate && parsed.lastSavedDate !== todayStr) {
                if (STATE.schedules) {
                    STATE.schedules.forEach(s => {
                        s.status = "pending";
                        s.notifiedStages = [];
                    });
                }
                STATE.lastSavedDate = todayStr;
                saveState(true); // 自動リセット時は再帰・多重同期を防ぐためpushはスキップしてローカル保存のみ
            }
        } catch (e) {
            console.error("データの読み込みに失敗しました。デフォルト値を使用します。", e);
        }
    } else {
        // 初回起動時はデフォルトスケジュールをセット
        STATE.schedules = [...DEFAULT_SCHEDULES];
        STATE.shopRewards = [...DEFAULT_REWARDS];
        STATE.lastSavedDate = todayStr;
        saveState();
    }
    
    // ご褒美データのフォールバック
    if (!STATE.shopRewards || STATE.shopRewards.length === 0) {
        STATE.shopRewards = [...DEFAULT_REWARDS];
    }
}

function saveState(skipPush = false) {
    const todayStr = new Date().toLocaleDateString("ja-JP");
    STATE.lastSavedDate = todayStr;

    // タイマーIDなどの非シリアライズオブジェクトは除外して保存
    const toSave = {
        level: STATE.level,
        xp: STATE.xp,
        coins: STATE.coins,
        unlockedCountries: STATE.unlockedCountries,
        placedCountries: STATE.placedCountries,
        createdCharacters: STATE.createdCharacters,
        schedules: STATE.schedules.map(s => ({ ...s, timerId: null })),
        shopRewards: STATE.shopRewards,
        rewardExchanges: STATE.rewardExchanges,
        pendingApprovals: STATE.pendingApprovals,
        geminiApiKey: STATE.geminiApiKey,
        lastNotifiedTaskId: STATE.lastNotifiedTaskId,
        syncGasUrl: STATE.syncGasUrl,
        voiceSpeed: STATE.voiceSpeed,
        lastSavedDate: STATE.lastSavedDate
    };
    localStorage.setItem("blue_voyage_state", JSON.stringify(toSave));

    // 同期URLが設定されていれば自動プッシュ (skipPushがtrueなら再帰防止のためスキップ)
    if (STATE.syncGasUrl && !skipPush) {
        pushStateToCloud();
    }
}



// ==========================================================================
// 5. 画面初期化 ＆ レンダリング
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    loadState();
    initAppClock();

    lucide.createIcons();
    renderHeader();
    renderTimeline();
    renderWorldMap();
    renderDiscoveredCountries();
    renderCreatedCharacters();
    renderParentSchedule();
    renderParentApprovalList();
    renderParentRewardsList();
    renderParentExchangeList();
    renderShopGoods();
    updateAiKeyBadge();
    initEventListeners();

    // 1秒に1回の定期監視
    setInterval(checkVoyageSchedules, 1000);

    // クラウド同期の初期設定
    updateSyncUI();
    if (STATE.syncGasUrl) {
        pullStateFromCloud();
        // 10秒ごとにバックグラウンドで最新データをプル
        setInterval(pullStateFromCloud, 10000);
    }

    // iPad/iOS 自動再生制限対策：ウェルカム画面のクリック処理
    const welcomeBtn = document.getElementById("btn-welcome-board");
    const welcomeOverlay = document.getElementById("welcome-overlay");
    if (welcomeBtn && welcomeOverlay) {
        welcomeBtn.addEventListener("click", () => {
            sound.init(); // 音声コンテキストの初期化
            
            // iOS自動再生制限解除のためのダミー音声発火と歓迎メッセージ
            speakVoice("乗船を確認しました。あおい船長、本日の大航海を始めましょう！");
            sound.playChime(); // 出航チャイム

            welcomeOverlay.classList.add("fade-out");
            setTimeout(() => {
                welcomeOverlay.style.display = "none";
            }, 500);
        });
    }
});

// ヘッダーUIの更新
function renderHeader() {
    const lvlEl = document.getElementById("captain-level");
    const coinEl = document.getElementById("coin-count");
    if (lvlEl) lvlEl.innerText = STATE.level;
    if (coinEl) coinEl.innerText = STATE.coins;
    
    // 発見した国の数表示
    const totalCount = COUNTRIES_DATA.length;
    const unlockedCount = STATE.unlockedCountries.length;
    const discEl = document.getElementById("discovered-countries");
    if (discEl) discEl.innerText = `${unlockedCount}/${totalCount}`;

    // レベルアップ進捗バー (1レベルあたり100XPで設計)
    const xpProgress = STATE.xp % 100;
    const fillEl = document.getElementById("level-progress-fill");
    if (fillEl) fillEl.style.width = `${xpProgress}%`;
}

// デジタル時計の開始
function initAppClock() {
    const timeEl = document.getElementById("current-time");
    function updateClock() {
        const d = new Date();
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        const secs = String(d.getSeconds()).padStart(2, '0');
        timeEl.innerText = `${hrs}:${mins}:${secs}`;
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// タイムラインのレンダリング
function renderTimeline() {
    const listEl = document.getElementById("timeline-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    if (STATE.schedules.length === 0) {
        listEl.innerHTML = `<p class="empty-message">航海スケジュールが登録されていません。司令室で設定してください。</p>`;
        return;
    }

    // 開始時間順にソートして表示
    const sorted = [...STATE.schedules].sort((a, b) => a.startTime.localeCompare(b.startTime));

    sorted.forEach(sched => {
        const item = document.createElement("div");
        item.className = `timeline-item ${sched.status}`;
        if (STATE.currentVoyage && STATE.currentVoyage.id === sched.id) {
            item.classList.add("active");
        }

        const country = sched.rewardCountryId === "random"
            ? { name: "ランダム（お楽しみ！）", flag: "🎲" }
            : (COUNTRIES_DATA.find(c => c.id === sched.rewardCountryId) || { name: "未知の国", flag: "🧭" });

        let statusLabel = "";
        if (sched.status === "completed") {
            statusLabel = `<span style="color: var(--success); font-weight:700;"><i data-lucide="check"></i> 完了</span>`;
        } else if (sched.status === "pending-approval") {
            statusLabel = `<span style="color: var(--warning); font-weight:700;"><i data-lucide="shield-alert"></i> 承認待ち</span>`;
        } else if (STATE.currentVoyage && STATE.currentVoyage.id === sched.id) {
            statusLabel = `<span style="color: var(--gold-dark); font-weight:700; animation: flash 1s infinite;">⛵ 航海中</span>`;
        } else {
            statusLabel = `<span>停泊中</span>`;
        }

        item.innerHTML = `
            <div class="timeline-time">${sched.startTime} 〜 ${sched.endTime}</div>
            <div class="timeline-content">
                <div>
                    <h3 class="timeline-title">${sched.title}</h3>
                    <div style="margin-top: 5px; font-size: 0.75rem; color: var(--text-muted); display:flex; gap:10px;">
                        <span>状態: ${statusLabel}</span>
                    </div>
                </div>
                <div class="timeline-reward">
                    <span>報酬: ${country.flag} ${country.name}</span>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });
    lucide.createIcons();
}

// 世界地図パズルボードのレンダリング (インラインリアルSVG・タッチ対応)
function renderWorldMap() {
    const canvasEl = document.getElementById("world-map-canvas");
    const guidesContainer = document.getElementById("map-guides-container");
    const inventoryEl = document.getElementById("ship-hold-inventory");
    const mapSvg = document.getElementById("world-map");

    if (!canvasEl || !guidesContainer || !inventoryEl || !mapSvg) return;

    guidesContainer.innerHTML = "";
    inventoryEl.innerHTML = "";

    // 地域フィルターの適用
    const filteredCountries = COUNTRIES_DATA.filter(country => {
        if (currentRegionFilter === "all") return true;
        if (currentRegionFilter === "asia") return country.region === "asia";
        if (currentRegionFilter === "europe") return country.region === "europe";
        if (currentRegionFilter === "africa") return country.region === "africa";
        if (currentRegionFilter === "de_facto") return country.region === "de_facto";
        if (currentRegionFilter === "americas_oceania") {
            return country.region === "americas" || country.region === "oceania";
        }
        return true;
    });

    // 1. 地図上の各国の状態の反映（SVG pathへのクラス付与とスタイル制御）
    const allPaths = mapSvg.querySelectorAll("path, g");
    allPaths.forEach(el => {
        el.classList.remove("puzzle-target-guide", "dragover", "filled", 
                            "fill-color-0", "fill-color-1", "fill-color-2", "fill-color-3", "fill-color-4");
    });

    COUNTRIES_DATA.forEach((country, index) => {
        const isPlaced = STATE.placedCountries.includes(country.id);
        const isUnlocked = STATE.unlockedCountries.includes(country.id);

        if (country.iso) {
            const mapEl = mapSvg.querySelector("#" + country.iso);
            if (mapEl) {
                if (isPlaced) {
                    mapEl.classList.add("filled", "fill-color-" + (index % 5));
                } else if (isUnlocked) {
                    mapEl.classList.add("puzzle-target-guide");
                }
            }
        } else {
            const target = document.createElement("div");
            target.className = "map-guide-target pin-target";
            target.style.left = country.mapX + "%";
            target.style.top = country.mapY + "%";
            target.dataset.id = country.id;

            if (isPlaced) {
                target.classList.add("filled");
                const pin = document.createElement("div");
                pin.className = "pin-piece";
                pin.innerText = country.flag;
                pin.title = country.name;
                pin.addEventListener("click", () => showCountryDetails(country));
                target.appendChild(pin);
            } else {
                if (isUnlocked) {
                    target.style.opacity = "1.0";
                } else {
                    target.style.opacity = "0.3";
                }
            }
            guidesContainer.appendChild(target);
        }
    });

    // 2. 船倉インベントリの描画
    const unlockedUnplaced = filteredCountries.filter(c => 
        STATE.unlockedCountries.includes(c.id) && !STATE.placedCountries.includes(c.id)
    );

    if (unlockedUnplaced.length === 0) {
        inventoryEl.innerHTML = '<p class="empty-message" style="width:100%; text-align:center;">船倉は空です。<br><span style="font-size:0.75rem; color:var(--text-muted);">（タスクをクリアして国を集めるか、フィルターを切り替えてみてね）</span></p>';
    } else {
        unlockedUnplaced.forEach(country => {
            const wrap = document.createElement("div");
            wrap.className = "inventory-item-wrap";

            const piece = document.createElement("div");
            piece.dataset.id = country.id;
            piece.style.cursor = "grab";

            if (country.iso) {
                piece.className = "drag-piece";
                const mapEl = mapSvg.querySelector("#" + country.iso);
                if (mapEl) {
                    let pathsHtml = "";
                    let targetBBoxEl = mapEl; // BBoxやSVGの抽出元要素

                    if (mapEl.tagName.toLowerCase() === "path") {
                        const d = mapEl.getAttribute("d");
                        pathsHtml = '<path d="' + d + '" fill="var(--gold-brass)" stroke="#fff" stroke-width="1.5px" />';
                    } else if (mapEl.tagName.toLowerCase() === "g") {
                        // mainland クラスを持つ path があれば、それを優先して主要部分のみを表示する (離島対策)
                        const mainlandEl = mapEl.querySelector(".mainland");
                        if (mainlandEl) {
                            targetBBoxEl = mainlandEl;
                            const d = mainlandEl.getAttribute("d");
                            pathsHtml = '<path d="' + d + '" fill="var(--gold-brass)" stroke="#fff" stroke-width="1.5px" />';
                        } else {
                            const subPaths = mapEl.querySelectorAll("path");
                            subPaths.forEach(sp => {
                                const d = sp.getAttribute("d");
                                pathsHtml += '<path d="' + d + '" fill="var(--gold-brass)" stroke="#fff" stroke-width="1.5px" />';
                            });
                        }
                    }

                    let bbox = { x: 30, y: 240, width: 780, height: 450 };
                    try {
                        if (typeof targetBBoxEl.getBBox === "function") {
                            bbox = targetBBoxEl.getBBox();
                        } else {
                            const clientRect = targetBBoxEl.getBoundingClientRect();
                            const svgRect = mapSvg.getBoundingClientRect();
                            if (svgRect.width > 0) {
                                const scaleX = 784 / svgRect.width;
                                const scaleY = 458 / svgRect.height;
                                bbox = {
                                    x: (clientRect.left - svgRect.left) * scaleX + 30,
                                    y: (clientRect.top - svgRect.top) * scaleY + 241,
                                    width: clientRect.width * scaleX,
                                    height: clientRect.height * scaleY
                                };
                            }
                        }
                    } catch (err) {
                        // ignore BBox err in Node.js test environment
                    }

                    const padding = Math.max(bbox.width, bbox.height) * 0.15;
                    const viewBoxStr = (bbox.x - padding) + " " + (bbox.y - padding) + " " + (bbox.width + padding * 2) + " " + (bbox.height + padding * 2);

                    piece.innerHTML = '<svg viewBox="' + viewBoxStr + '" width="100%" height="100%">' + pathsHtml + '</svg>';
                } else {
                    piece.innerText = country.flag;
                }
            } else {
                piece.className = "pin-piece";
                piece.innerText = country.flag;
            }

            setupDragEvents(piece, country.id);

            const nameSpan = document.createElement("span");
            nameSpan.className = "inventory-item-name";
            nameSpan.innerText = country.name;

            wrap.appendChild(piece);
            wrap.appendChild(nameSpan);
            inventoryEl.appendChild(wrap);
        });
    }
    lucide.createIcons();
}

function setupDragEvents(piece, countryId) {
    piece.addEventListener("mousedown", (e) => {
        initiateDrag(e, piece, countryId, false);
    });

    piece.addEventListener("touchstart", (e) => {
        initiateDrag(e, piece, countryId, true);
    }, { passive: false });
}

function initiateDrag(e, piece, countryId, isTouch) {
    if (activeDrag.element) return;

    if (isTouch) {
        e.preventDefault();
    }

    lastDragWasReal = false; // ドラッグ開始時は初期化

    const point = isTouch ? e.touches[0] : e;
    const rect = piece.getBoundingClientRect();
    
    const offsetX = point.clientX - rect.left;
    const offsetY = point.clientY - rect.top;

    const dragEl = piece.cloneNode(true);
    dragEl.style.position = "fixed";
    dragEl.style.left = rect.left + "px";
    dragEl.style.top = rect.top + "px";
    dragEl.style.width = rect.width + "px";
    dragEl.style.height = rect.height + "px";
    dragEl.style.zIndex = "9999";
    dragEl.style.pointerEvents = "none";
    dragEl.classList.add("dragging");

    document.body.appendChild(dragEl);

    piece.style.opacity = "0.4";

    activeDrag = {
        element: dragEl,
        originalElement: piece,
        countryId: countryId,
        offsetX: offsetX,
        offsetY: offsetY,
        isTouch: isTouch
    };

    if (isTouch) {
        window.addEventListener("touchmove", handleDragMove, { passive: false });
        window.addEventListener("touchend", handleDragEnd);
    } else {
        window.addEventListener("mousemove", handleDragMove);
        window.addEventListener("mouseup", handleDragEnd);
    }
}

function handleDragMove(e) {
    if (!activeDrag.element) return;

    if (activeDrag.isTouch) {
        e.preventDefault();
    }

    lastDragWasReal = true; // 実際にドラッグが動いたらtrueにする

    const point = activeDrag.isTouch ? e.touches[0] : e;
    const dragEl = activeDrag.element;

    const newLeft = point.clientX - activeDrag.offsetX;
    const newTop = point.clientY - activeDrag.offsetY;
    dragEl.style.left = newLeft + "px";
    dragEl.style.top = newTop + "px";

    const country = COUNTRIES_DATA.find(c => c.id === activeDrag.countryId);
    if (!country) return;

    const mapSvg = document.getElementById("world-map");

    if (country.iso && mapSvg) {
        const targetPath = mapSvg.querySelector("#" + country.iso);
        if (targetPath) {
            const rect = targetPath.getBoundingClientRect();
            const targetCenterX = rect.left + rect.width / 2;
            const targetCenterY = rect.top + rect.height / 2;

            const pieceRect = dragEl.getBoundingClientRect();
            const pieceCenterX = pieceRect.left + pieceRect.width / 2;
            const pieceCenterY = pieceRect.top + pieceRect.height / 2;

            const dist = Math.hypot(targetCenterX - pieceCenterX, targetCenterY - pieceCenterY);
            const snapRadius = Math.max(35, Math.min(rect.width, rect.height) * 0.6);

            if (dist < snapRadius) {
                targetPath.classList.add("dragover");
            } else {
                targetPath.classList.remove("dragover");
            }
        }
    } else {
        const targets = document.querySelectorAll(".map-guide-target.pin-target");
        targets.forEach(target => {
            if (target.dataset.id !== activeDrag.countryId) {
                target.classList.remove("dragover");
                return;
            }

            const rect = target.getBoundingClientRect();
            const targetCenterX = rect.left + rect.width / 2;
            const targetCenterY = rect.top + rect.height / 2;

            const pieceRect = dragEl.getBoundingClientRect();
            const pieceCenterX = pieceRect.left + pieceRect.width / 2;
            const pieceCenterY = pieceRect.top + pieceRect.height / 2;

            const dist = Math.hypot(targetCenterX - pieceCenterX, targetCenterY - pieceCenterY);

            if (dist < 35) {
                target.classList.add("dragover");
            } else {
                target.classList.remove("dragover");
            }
        });
    }
}

function handleDragEnd(e) {
    if (!activeDrag.element) return;

    const dragEl = activeDrag.element;
    const originalPiece = activeDrag.originalElement;
    const countryId = activeDrag.countryId;

    const country = COUNTRIES_DATA.find(c => c.id === countryId);
    const mapSvg = document.getElementById("world-map");
    let snapped = false;

    // もしドラッグされずにその場で指/マウスを離した（タップされた）場合
    const isTap = !lastDragWasReal;

    // 後処理
    dragEl.remove();
    originalPiece.style.opacity = "1.0";

    if (activeDrag.isTouch) {
        window.removeEventListener("touchmove", handleDragMove);
        window.removeEventListener("touchend", handleDragEnd);
    } else {
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
    }

    if (isTap) {
        if (country) {
            showPlaceConfirmModal(country);
        }
        activeDrag = {
            element: null,
            originalElement: null,
            countryId: null,
            offsetX: 0,
            offsetY: 0,
            isTouch: false
        };
        return;
    }

    if (country) {
        if (country.iso && mapSvg) {
            const targetPath = mapSvg.querySelector("#" + country.iso);
            if (targetPath) {
                targetPath.classList.remove("dragover"); // dragoverを解除

                const rect = targetPath.getBoundingClientRect();
                const targetCenterX = rect.left + rect.width / 2;
                const targetCenterY = rect.top + rect.height / 2;

                const pieceRect = dragEl.getBoundingClientRect();
                const pieceCenterX = pieceRect.left + pieceRect.width / 2;
                const pieceCenterY = pieceRect.top + pieceRect.height / 2;

                const dist = Math.hypot(targetCenterX - pieceCenterX, targetCenterY - pieceCenterY);
                const snapRadius = Math.max(35, Math.min(rect.width, rect.height) * 0.6);

                if (dist < snapRadius) {
                    snapped = true;
                }
            }
        } else {
            const target = document.querySelector(".map-guide-target.pin-target[data-id=\"" + countryId + "\"]");
            if (target) {
                target.classList.remove("dragover"); // dragoverを解除

                const rect = target.getBoundingClientRect();
                const targetCenterX = rect.left + rect.width / 2;
                const targetCenterY = rect.top + rect.height / 2;

                const pieceRect = dragEl.getBoundingClientRect();
                const pieceCenterX = pieceRect.left + pieceRect.width / 2;
                const pieceCenterY = pieceRect.top + pieceRect.height / 2;

                const dist = Math.hypot(targetCenterX - pieceCenterX, targetCenterY - pieceCenterY);

                if (dist < 35) {
                    snapped = true;
                }
            }
        }
    }

    if (snapped) {
        if (!STATE.placedCountries.includes(countryId)) {
            STATE.placedCountries.push(countryId);
            saveState();
        }

        sound.playSnap();

        const countryName = country ? country.name : "新しい国";
        updateSecretaryMessage("見事です！『" + countryName + "』のピースを世界地図の正しい場所にはめ込みましたね！");

        checkAllPuzzlesCompleted();
        renderWorldMap();
    } else {
        renderWorldMap();
    }

    activeDrag = {
        element: null,
        originalElement: null,
        countryId: null,
        offsetX: 0,
        offsetY: 0,
        isTouch: false
    };
}

function checkAllPuzzlesCompleted() {
    const allCompleted = COUNTRIES_DATA.every(function(c) { return STATE.placedCountries.includes(c.id); });
    if (allCompleted) {
        sound.playFanfare();
        updateSecretaryMessage("素晴らしい！蒼船長！ついに世界すべての国と地域を配置し、大航海世界地図が完成しました！最高の偉業です！");
        alert("🎉🎉🎉【世界地図完成！】🎉🎉🎉\nおめでとうございます、蒼船長！\nすべての国と地域のピースを正しい位置にはめ込み、世界地図が完成しました！\nこれで蒼船長は世界一の大冒険家です！");
    }
}

// 国の国旗画像URLを取得するヘルパー（Windows等の絵文字対策）
function getCountryFlagUrl(country) {
    const isoMap = {
        "vatican": "va",
        "kosovo": "xk",
        "palestine": "ps",
        "western_sahara": "eh",
        "hong_kong": "hk",
        "macau": "mo",
        "somaliland": "so",
        "northern_cyprus": "cy",
        "transnistria": "md",
        "antarctica": "aq"
    };

    let code = "";
    if (country.iso) {
        code = country.iso.toLowerCase();
        if (code.startsWith("_")) {
            code = code.substring(1);
        }
    } else {
        code = isoMap[country.id] || "un";
    }

    return `https://flagcdn.com/w160/${code}.png`;
}

// タップ配置用の自動配置処理
function placeCountryAutomatically(countryId) {
    const country = COUNTRIES_DATA.find(c => c.id === countryId);
    if (!country) return;

    if (!STATE.placedCountries.includes(countryId)) {
        STATE.placedCountries.push(countryId);
        saveState();
    }

    sound.playSnap(); // キュピーン！

    const countryName = country.name;
    updateSecretaryMessage("見事です！『" + countryName + "』のピースを世界地図の正しい場所にはめ込みましたね！");

    checkAllPuzzlesCompleted();
    
    // パズルボードと図鑑の再描画
    renderWorldMap();
    
    // 発見した国々リストも更新
    renderDiscoveredCountries();
    
    // 親子同期がある場合はクラウドにも同期
    if (STATE.syncGasUrl) {
        pushStateToCloud();
    }
}

// はめ込み確認用モーダル
function showPlaceConfirmModal(country) {
    const existingModal = document.querySelector(".country-modal-overlay");
    if (existingModal) existingModal.remove();

    const overlay = document.createElement("div");
    overlay.className = "country-modal-overlay";

    overlay.innerHTML = `
        <div class="country-modal-card parchment" style="max-width: 400px; text-align: center; border: 3px double var(--gold-brass); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <button class="country-modal-close" id="btn-close-place-modal">✕</button>
            <h3 style="margin-top: 15px; border-bottom: 2px dashed rgba(92, 78, 54, 0.3); padding-bottom: 10px; color: var(--gold-brass); font-family: 'Georgia', serif;">
                ⚓️ パズルをはめ込むかい？
            </h3>
            <div style="margin: 25px 0; font-size: 1.15rem; line-height: 1.6; color: var(--text-dark); font-weight: 500;">
                <strong>${country.flag} ${country.name}</strong> のピースを<br>
                世界地図の正しい場所にはめ込みますか？
            </div>
            <div style="display: flex; gap: 15px; justify-content: center; margin-top: 20px; margin-bottom: 10px;">
                <button class="btn btn-secondary" id="btn-cancel-place" style="padding: 10px 20px; font-weight:700; border-radius: 6px;">やめる</button>
                <button class="btn btn-primary" id="btn-confirm-place" style="padding: 10px 25px; font-weight:700; background: var(--gold-brass); color: var(--text-dark); border-color: var(--gold-bright); border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">はい、はめる！</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.classList.add("fade-out");
        setTimeout(() => overlay.remove(), 250);
    };

    document.getElementById("btn-close-place-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-place").addEventListener("click", closeModal);
    document.getElementById("btn-confirm-place").addEventListener("click", () => {
        closeModal();
        placeCountryAutomatically(country.id);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });
}

// 国詳細をモーダル表示し、右側に国旗画像を表示する（クイズなし）
function showCountryDetails(country) {
    const existingModal = document.querySelector(".country-modal-overlay");
    if (existingModal) existingModal.remove();

    const regionMap = {
        "asia": "アジア",
        "europe": "ヨーロッパ",
        "africa": "アフリカ",
        "americas": "アメリカ地域",
        "oceania": "オセアニア",
        "de_facto": "実質上の国・特別地域"
    };
    const regionJa = regionMap[country.region] || country.region;
    const flagUrl = getCountryFlagUrl(country);

    const overlay = document.createElement("div");
    overlay.className = "country-modal-overlay";

    overlay.innerHTML = `
        <div class="country-modal-card parchment">
            <button class="country-modal-close" id="btn-close-country-modal">✕</button>
            <div class="country-modal-header">
                <div class="country-modal-title-area">
                    <h3>${country.name}</h3>
                    <p>首都: <strong>${country.capital}</strong> &nbsp;|&nbsp; 地域: <strong>${regionJa}</strong></p>
                </div>
                <img src="${flagUrl}" class="country-modal-flag-large" alt="${country.name}の国旗" />
            </div>
            <div class="country-modal-body">
                <div class="country-modal-trivia" style="margin-bottom:0;">
                    📖 <strong>ミニ解説:</strong><br>
                    ${country.trivia}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // 閉じるイベント
    const closeModal = () => {
        overlay.classList.add("fade-out");
        setTimeout(() => overlay.remove(), 250);
    };
    document.getElementById("btn-close-country-modal").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });
}

// 発見した国々リストのレンダリング
function renderDiscoveredCountries() {
    const listEl = document.getElementById("countries-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const unlocked = COUNTRIES_DATA.filter(c => STATE.unlockedCountries.includes(c.id));

    if (unlocked.length === 0) {
        listEl.innerHTML = `<p class="empty-message">まだアンロックされた国がありません。</p>`;
        return;
    }

    unlocked.forEach(country => {
        const flagUrl = getCountryFlagUrl(country);
        const card = document.createElement("div");
        card.className = "country-entry-card";
        card.innerHTML = `
            <img src="${flagUrl}" class="country-flag-icon-img" alt="${country.name}の国旗" style="width: 32px; height: 20px; object-fit: cover; border-radius: 2px; border: 1px solid rgba(0,0,0,0.15); margin-right: 12px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));" />
            <div class="country-details">
                <h4>${country.name}</h4>
                <p>首都: ${country.capital}</p>
            </div>
        `;
        card.addEventListener("click", () => showCountryDetails(country));
        listEl.appendChild(card);
    });
}

// 創作キャラクター（Mod）ギャラリーのレンダリング
function renderCreatedCharacters() {
    const galleryEl = document.getElementById("created-characters-gallery");
    if (!galleryEl) return;
    galleryEl.innerHTML = "";

    if (STATE.createdCharacters.length === 0) {
        galleryEl.innerHTML = `<p class="empty-message">登録された創作キャラクターはありません。上のフォームから、厚紙で作ったキャラなどを追加してみよう！</p>`;
        return;
    }

    STATE.createdCharacters.forEach((char, index) => {
        const item = document.createElement("div");
        item.className = "char-gallery-item";

        let badgeClass = "toilet";
        let typeName = "スキビディ";
        if (char.type === "custom-country") {
            badgeClass = "custom-country";
            typeName = "オリジナル国";
        } else if (char.type === "item") {
            badgeClass = "item";
            typeName = "お宝";
        }

        item.innerHTML = `
            <div class="char-item-info">
                <h4>${char.name}</h4>
                <p>${char.desc || '説明なし'}</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="char-badge ${badgeClass}">${typeName}</span>
                <button class="btn-action btn-danger btn-sm" onclick="deleteCharacter(${index})" style="padding: 2px 6px; font-size:0.65rem;">削除</button>
            </div>
        `;
        galleryEl.appendChild(item);
    });
}

// 創作キャラの削除
window.deleteCharacter = function(index) {
    if (confirm("このキャラクターをコレクションから削除しますか？")) {
        STATE.createdCharacters.splice(index, 1);
        saveState();
        renderCreatedCharacters();
    }
};

// 親用スケジュール管理テーブルのレンダリング
function renderParentSchedule() {
    const tbody = document.getElementById("parent-schedule-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    // 国選択のドロップダウンも合わせて更新（地域別グループ化＆所有状況表示）
    const rewardSelect = document.getElementById("sched-reward");
    if (rewardSelect) {
        rewardSelect.innerHTML = "";

        // 🎲 ランダム オプションを一番上に追加
        const randomOpt = document.createElement("option");
        randomOpt.value = "random";
        randomOpt.innerText = "🎲 ランダム（お楽しみ！）";
        rewardSelect.appendChild(randomOpt);

        const regionLabels = {
            "asia": "アジア",
            "europe": "ヨーロッパ",
            "africa": "アフリカ",
            "americas": "アメリカ地域",
            "oceania": "オセアニア",
            "de_facto": "実質上の国・特別地域"
        };

        const groups = {};
        Object.keys(regionLabels).forEach(key => {
            groups[key] = [];
        });

        COUNTRIES_DATA.forEach(c => {
            const reg = c.region || "asia";
            if (groups[reg]) {
                groups[reg].push(c);
            } else {
                groups["asia"].push(c);
            }
        });

        Object.keys(regionLabels).forEach(key => {
            const countriesInGroup = groups[key];
            if (countriesInGroup.length > 0) {
                const optgroup = document.createElement("optgroup");
                optgroup.label = regionLabels[key];
                countriesInGroup.forEach(c => {
                    const isPlaced = STATE.placedCountries.includes(c.id);
                    const isUnlocked = STATE.unlockedCountries.includes(c.id);
                    let statusText = "";
                    if (isPlaced) {
                        statusText = " [配置済]";
                    } else if (isUnlocked) {
                        statusText = " [所持中]";
                    }

                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.innerText = `${c.flag} ${c.name}${statusText}`;
                    optgroup.appendChild(opt);
                });
                rewardSelect.appendChild(optgroup);
            }
        });
    }

    if (STATE.schedules.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-message">予定はありません。</td></tr>`;
        return;
    }

    STATE.schedules.forEach(sched => {
        const tr = document.createElement("tr");
        const country = sched.rewardCountryId === "random"
            ? { name: "ランダム（お楽しみ！）", flag: "🎲" }
            : (COUNTRIES_DATA.find(c => c.id === sched.rewardCountryId) || { name: "なし", flag: "🧭" });

        let statusText = "待機中";
        if (sched.status === "completed") statusText = "完了済み";
        else if (sched.status === "pending-approval") statusText = "承認待ち";
        else if (STATE.currentVoyage && STATE.currentVoyage.id === sched.id) statusText = "航海中";

        tr.innerHTML = `
            <td><strong>${sched.startTime} 〜 ${sched.endTime}</strong></td>
            <td>${sched.title}</td>
            <td>${country.flag} ${country.name}</td>
            <td>
                <button class="btn-action btn-secondary btn-sm" style="margin-right: 5px; background: var(--gold-dark); border-color: var(--gold-dark); color: white;" onclick="editSchedule('${sched.id}')">
                    <i data-lucide="pencil" style="width:12px; height:12px; margin-right:3px;"></i> 編集
                </button>
                <button class="btn-action btn-danger btn-sm" onclick="deleteSchedule('${sched.id}')">
                    <i data-lucide="trash-2" style="width:12px; height:12px; margin-right:3px;"></i> 削除
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    if (typeof lucide !== "undefined") lucide.createIcons();
};

window.editSchedule = function(id) {
    const sched = STATE.schedules.find(s => s.id === id);
    if (!sched) return;

    document.getElementById("sched-title").value = sched.title;
    document.getElementById("sched-start").value = sched.startTime;
    document.getElementById("sched-end").value = sched.endTime;
    document.getElementById("sched-reward").value = sched.rewardCountryId;

    STATE.editingScheduleId = id;

    const submitBtn = document.getElementById("btn-add-schedule-submit");
    if (submitBtn) {
        submitBtn.innerHTML = `<i data-lucide="save"></i> 変更を保存`;
    }
    const cancelBtn = document.getElementById("btn-cancel-edit-schedule");
    if (cancelBtn) {
        cancelBtn.style.display = "inline-flex";
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
};

window.cancelEditSchedule = function() {
    STATE.editingScheduleId = null;
    document.getElementById("sched-title").value = "";
    document.getElementById("sched-start").value = "";
    document.getElementById("sched-end").value = "";

    const submitBtn = document.getElementById("btn-add-schedule-submit");
    if (submitBtn) {
        submitBtn.innerHTML = `<i data-lucide="plus-circle"></i> 予定を追加`;
    }
    const cancelBtn = document.getElementById("btn-cancel-edit-schedule");
    if (cancelBtn) {
        cancelBtn.style.display = "none";
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
};

window.deleteSchedule = function(id) {
    if (confirm("この予定を削除しますか？")) {
        STATE.schedules = STATE.schedules.filter(s => s.id !== id);
        if (STATE.currentVoyage && STATE.currentVoyage.id === id) {
            clearInterval(STATE.currentVoyage.timerId);
            STATE.currentVoyage = null;
            resetCompassTimerUI();
        }
        saveState();
        renderTimeline();
        renderParentSchedule();
    }
};

// 親用承認リストのレンダリング
function renderParentApprovalList() {
    const listEl = document.getElementById("parent-approval-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const approvals = STATE.schedules.filter(s => s.status === "pending-approval");

    if (approvals.length === 0) {
        listEl.innerHTML = `<p class="empty-message">現在、承認待ちのタスクはありません。</p>`;
        return;
    }

    approvals.forEach(sched => {
        const item = document.createElement("div");
        item.className = "approval-item";

        const country = sched.rewardCountryId === "random"
            ? { name: "ランダム（お楽しみ！）", flag: "🎲" }
            : (COUNTRIES_DATA.find(c => c.id === sched.rewardCountryId) || { name: "未知の国", flag: "🧭" });

        item.innerHTML = `
            <div class="approval-info">
                <h4>蒼君が「${sched.title}」を完了しました！</h4>
                <p>報酬アンロック: ${country.flag} ${country.name} (＋100ゴールド、＋50 XP)</p>
            </div>
            <button class="btn-action btn-success" onclick="approveTask('${sched.id}')">
                <i data-lucide="check-circle"></i> 入港を承認する！
            </button>
        `;
        listEl.appendChild(item);
    });
    lucide.createIcons();
}

// 親的承認処理
window.approveTask = function(id) {
    const taskIndex = STATE.schedules.findIndex(s => s.id === id);
    if (taskIndex !== -1) {
        const task = STATE.schedules[taskIndex];
        task.status = "completed";

        // 報酬付与
        STATE.coins += 100;
        STATE.xp += 50;

        // レベルアップ判定
        const newLevel = Math.floor(STATE.xp / 100) + 1;
        let leveledUp = false;
        if (newLevel > STATE.level) {
            STATE.level = newLevel;
            leveledUp = true;
        }

        // もしランダム報酬の場合、未アンロックの国から抽選する
        let isRandom = false;
        if (task.rewardCountryId === "random") {
            isRandom = true;
            const lockedCountries = COUNTRIES_DATA.filter(c => !STATE.unlockedCountries.includes(c.id));
            if (lockedCountries.length > 0) {
                const randomCountry = lockedCountries[Math.floor(Math.random() * lockedCountries.length)];
                task.rewardCountryId = randomCountry.id;
            } else {
                task.rewardCountryId = COUNTRIES_DATA[Math.floor(Math.random() * COUNTRIES_DATA.length)].id;
            }
        }

        // 国のアンロック
        if (!STATE.unlockedCountries.includes(task.rewardCountryId)) {
            STATE.unlockedCountries.push(task.rewardCountryId);
        }

        saveState();
        sound.playFanfare();

        // 画面の更新
        renderHeader();
        renderTimeline();
        renderWorldMap();
        renderDiscoveredCountries();
        renderParentApprovalList();

        const country = COUNTRIES_DATA.find(c => c.id === task.rewardCountryId) || { name: "新しい国" };
        
        let msg = `🎉 蒼君の頑張りを承認しました！\n『${country.name}』のパズルピースがアンロックされました！`;
        if (leveledUp) {
            msg += `\n🌟 さらに、蒼君の航海レベルが【レベル ${STATE.level}】にアップしました！`;
        }
        alert(msg);

        // 秘書からのメッセージ更新
        const secMsg = leveledUp 
            ? `蒼船長！おめでとうございます！ついに航海レベルが ${STATE.level} に上がりましたよ！さらに遠い海へと進みましょう！`
            : `お見事です、船長！無事に入港許可が下り、${country.name}のパズルが手に入りました。次の航海の準備を始めましょう！`;
        updateSecretaryMessage(secMsg);
    }
};

// AIキーバッジの表示更新
function updateAiKeyBadge() {
    const badge = document.getElementById("ai-key-badge");
    const keyInput = document.getElementById("input-gemini-key");
    const clearBtn = document.getElementById("btn-clear-key");

    if (STATE.geminiApiKey) {
        badge.innerHTML = `<span class="badge badge-success"><i data-lucide="check-circle-2"></i> AIコンパス起動中 (Gemini接続済)</span>`;
        keyInput.value = "••••••••••••••••••••••••";
        clearBtn.style.display = "inline-flex";
    } else {
        badge.innerHTML = `<span class="badge badge-warning"><i data-lucide="alert-triangle"></i> APIキー未設定 (デモモード)</span>`;
        keyInput.value = "";
        clearBtn.style.display = "none";
    }
    lucide.createIcons();
}

// 秘書メッセージの更新
function updateSecretaryMessage(msg) {
    document.getElementById("secretary-message").innerText = msg;
}

// ==========================================================================
// 5-B. ご褒美ショップ & ガチャ ＆ 親用ご褒美管理のレンダリング
// ==========================================================================

// 1. 蒼君用ショップ（交易所）の描画
function renderShopGoods() {
    const gridEl = document.getElementById("shop-goods-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";

    if (STATE.shopRewards.length === 0) {
        gridEl.innerHTML = `<p class="empty-message" style="grid-column: 1/-1;">現在、交易所にお宝はありません。司令室でご褒美を登録してください。</p>`;
        return;
    }

    STATE.shopRewards.forEach(reward => {
        const card = document.createElement("div");
        card.className = "good-card";

        const iconMap = {
            "gamepad-2": "gamepad-2",
            "cookie": "cookie",
            "book-open": "book-open",
            "heart": "heart"
        };
        const iconName = iconMap[reward.icon] || "gift";

        card.innerHTML = `
            <div class="good-info-area">
                <div class="good-icon">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="good-details">
                    <h4>${reward.name}</h4>
                    <span class="good-price"><i data-lucide="coins" style="width:12px; height:12px; color:var(--gold-bright);"></i> ${reward.price} G</span>
                </div>
            </div>
            <button class="btn-action btn-primary" onclick="buyReward('${reward.id}')">
                <i data-lucide="shopping-cart"></i> 交換する
            </button>
        `;
        gridEl.appendChild(card);
    });
    lucide.createIcons();
}

// 蒼君のご褒美交換（購入）処理
window.buyReward = function(id) {
    const reward = STATE.shopRewards.find(r => r.id === id);
    if (!reward) return;

    if (STATE.coins < reward.price) {
        alert(`❌ ゴールドが足りません！\n必要: ${reward.price} G / 所持: ${STATE.coins} G\n宿題や試験勉強をクリアしてゴールドを貯めましょう！`);
        return;
    }

    if (confirm(`🪙 ${reward.name} を ${reward.price}ゴールドと交換しますか？`)) {
        STATE.coins -= reward.price;
        
        // 交換リクエストを追加
        const newExchange = {
            id: "ex-" + Date.now(),
            name: reward.name,
            price: reward.price,
            icon: reward.icon,
            status: "pending",
            date: new Date().toLocaleDateString()
        };
        STATE.rewardExchanges.push(newExchange);
        saveState();

        sound.playChime();
        renderHeader();
        renderShopGoods();
        renderParentExchangeList();

        alert(`🎉 交換リクエストを送信しました！\n親御さんの司令室へ「${reward.name}」のサインをもらいに行ってね！`);
        updateSecretaryMessage(`ご褒美「${reward.name}」の交換を申請しました。親御さんにサインをもらって引き換えましょう！`);
    }
};

// 2. 親用ご褒美設定リストの描画
function renderParentRewardsList() {
    const tbody = document.getElementById("parent-rewards-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (STATE.shopRewards.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-message">ご褒美アイテムがありません。</td></tr>`;
        return;
    }

    STATE.shopRewards.forEach(reward => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${reward.name}</strong></td>
            <td><i data-lucide="coins" style="width:12px; height:12px; display:inline-block; vertical-align:middle;"></i> ${reward.price} G</td>
            <td><i data-lucide="${reward.icon}"></i></td>
            <td>
                <button class="btn-action btn-danger btn-sm" onclick="deleteReward('${reward.id}')">
                    <i data-lucide="trash-2"></i> 削除
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

// 親用：ご褒美削除
window.deleteReward = function(id) {
    if (confirm("このご褒美アイテムを削除しますか？")) {
        STATE.shopRewards = STATE.shopRewards.filter(r => r.id !== id);
        saveState();
        renderShopGoods();
        renderParentRewardsList();
    }
};

// 3. 親用交換リクエスト履歴リストの描画
function renderParentExchangeList() {
    const listEl = document.getElementById("parent-exchange-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const pendings = STATE.rewardExchanges.filter(e => e.status === "pending");

    if (pendings.length === 0) {
        listEl.innerHTML = `<p class="empty-message">現在、蒼君からのご褒美交換リクエストはありません。</p>`;
        return;
    }

    pendings.forEach(ex => {
        const item = document.createElement("div");
        item.className = "approval-item";
        item.style.borderColor = "var(--gold-brass)";
        item.innerHTML = `
            <div class="approval-info">
                <h4>蒼君がご褒美「${ex.name}」の引き換えを希望しています</h4>
                <p>消費ゴールド: ${ex.price} G (申請日: ${ex.date})</p>
            </div>
            <button class="btn-action btn-success" onclick="approveExchange('${ex.id}')">
                <i data-lucide="gift"></i> 承認して渡す！
            </button>
        `;
        listEl.appendChild(item);
    });
    lucide.createIcons();
}

// 親用：交換リクエスト承認
window.approveExchange = function(id) {
    const ex = STATE.rewardExchanges.find(e => e.id === id);
    if (!ex) return;

    if (confirm(`🎁 「${ex.name}」を蒼君に渡しましたか？ 承認するとリストから消去されます。`)) {
        ex.status = "completed";
        saveState();

        sound.playFanfare(); // ファンファーレ

        renderParentExchangeList();
        alert(`ご褒美「${ex.name}」の引き渡しを完了（承認）しました。`);
    }
};

// 4. ガチャ抽選システム
window.spinGacha = function() {
    if (STATE.coins < 100) {
        alert("🪙 ガチャには 100ゴールド 必要です！\n宿題をクリアしてゴールドを貯めましょう！");
        return;
    }

    const btn = document.getElementById("btn-spin-gacha");
    const machine = document.getElementById("gacha-machine");

    btn.disabled = true;
    machine.classList.add("spinning");

    sound.playGacha(); // ガラガラ効果音

    setTimeout(() => {
        machine.classList.remove("spinning");
        btn.disabled = false;

        // ガチャ結果の生成
        STATE.coins -= 100;

        // 蒼君の興味のある要素をランダムに組み合わせる
        const prefixes = ["ゴールド", "ギャラクシー", "シャドー", "タイタン", "カイロ", "パリ", "ナポレオン", "コソボ", "台湾", "グリーンランド"];
        const middle = ["トイレ", "カメラマン", "スピーカー", "テレビマン", "パズル", "羅針盤"];
        const suffixes = ["Mod", "チップ", "コア", "ギア", "人形"];

        const randomName = 
            prefixes[Math.floor(Math.random() * prefixes.length)] + "・" +
            middle[Math.floor(Math.random() * middle.length)] + " " +
            suffixes[Math.floor(Math.random() * suffixes.length)];

        // レア度の判定
        const rand = Math.random() * 100;
        let rarity = "toilet"; // デフォルト
        let rarityName = "レア (R)";
        let desc = "大航海で集めた素材でクラフトしたModアイテム。";

        if (rand < 3) {
            rarity = "item"; // ゴールドバッジ
            rarityName = "ウルトラレア (UR) 🌟";
            desc = "★★★ 伝説級の超ウルトラお宝Mod！凄まじいクリエイティビティの結晶。";
        } else if (rand < 20) {
            rarity = "custom-country"; // ブラウンバッジ
            rarityName = "スーパーレア (SR) ✨";
            desc = "★★ 強力なシミュレーション効果を持つスーパーMod。";
        }

        const newChar = {
            name: randomName,
            desc: `${rarityName} - ${desc}`,
            type: rarity
        };

        STATE.createdCharacters.push(newChar);
        saveState();

        sound.playFanfare(); // ファンファーレ

        renderHeader();
        renderCreatedCharacters();

        alert(`🎰 【ガチャ結果】\n-------------------------------\n🎉 『${randomName}』を引きました！\nレア度: ${rarityName}\n\n「創作ギャラリー」に追加されました！`);
        updateSecretaryMessage(`ガチャから『${randomName}』が出現しました！素晴らしいお宝ですね、船長！`);

    }, 1500); // 1.5秒ガラガラ回る
};

// ==========================================================================
// 6. 航海時間の監視 ＆ 「わくわく出航呼びかけ」ロジック
// ==========================================================================
function checkVoyageSchedules() {
    const now = new Date();
    const todayStr = now.toLocaleDateString("ja-JP");

    // 動作中の日付またぎ自動リセット
    if (STATE.lastSavedDate && STATE.lastSavedDate !== todayStr) {
        if (STATE.schedules) {
            STATE.schedules.forEach(s => {
                s.status = "pending";
                s.notifiedStages = [];
            });
        }
        STATE.lastSavedDate = todayStr;
        saveState(); // 同期も一緒に走らせる
    }

    // すでに現在出航中なら、新たな呼びかけはしない
    if (STATE.currentVoyage) return;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    function toMins(timeStr) {
        const [h, m] = timeStr.split(":").map(Number);
        return h * 60 + m;
    }

    // 各スケジュールをスキャン
    STATE.schedules.forEach(sched => {
        if (sched.status === "pending") {
            const startMins = toMins(sched.startTime);
            const endMins = toMins(sched.endTime);

            if (!sched.notifiedStages) {
                sched.notifiedStages = [];
            }

            let targetStage = null;
            if (currentMinutes >= (startMins - 10) && currentMinutes < (startMins - 5)) {
                targetStage = "10min";
            } else if (currentMinutes >= (startMins - 5) && currentMinutes < startMins) {
                targetStage = "5min";
            } else if (currentMinutes >= startMins && currentMinutes < endMins) {
                targetStage = "exact";
            }

            if (targetStage && !sched.notifiedStages.includes(targetStage)) {
                // すでに通知モーダルが表示されている場合は重複して出さない
                const overlay = document.getElementById("notification-overlay");
                if (overlay && overlay.style.display === "flex") {
                    return;
                }

                sched.notifiedStages.push(targetStage);
                saveState();
                triggerVoyageNotification(sched, targetStage);
            }
        }
    });
}

// わくわく出航呼びかけモーダルの起動
function triggerVoyageNotification(sched, stage = "exact") {
    STATE.lastNotifiedTaskId = sched.id;
    saveState();

    const country = sched.rewardCountryId === "random"
        ? { name: "ランダム（お楽しみ！）", flag: "🎲" }
        : (COUNTRIES_DATA.find(c => c.id === sched.rewardCountryId) || { name: "未知の国", flag: "🧭" });

    let stageLabel = "";
    let speechText = "";
    if (stage === "10min") {
        stageLabel = "【出発10分前】";
        speechText = `あおい君、出発の10分前だよ。今日の目的地、${country.name}の地図ピースがもらえるチャンス。準備を始めよう！`;
    } else if (stage === "5min") {
        stageLabel = "【出発5分前】";
        speechText = `あおい君、出発の5分前だよ。${country.name}に向けて、そろそろ羅針盤をセットしよう！`;
    } else {
        stageLabel = "【出発の時間！】";
        speechText = `あおい君、出発の時間だよ！今日の目的地、${country.name}に向けて、一緒に出航の舵を切ろう！`;
    }

    // UIのテキストをセット
    document.getElementById("notify-country-name").innerText = `${stageLabel} ${country.flag} ${country.name}`;
    
    // 蒼君の好きな要素を取り入れた、ポジティブでワクワクする通知メッセージ
    const motivators = [
        `「蒼船長！新しい海域の地図が届いたよ。今日のタスクをクリアして、世界の国々をアンロックしよう！」`,
        `「おーい蒼、出発の準備はいい？今日の航海を始めると、念願の『${country.name}』の地図が手に入りそうだよ！」`,
        `「蒼船長、羅針盤が${country.name}の方向を指しているよ！今日の勉強を倒して、新しいコレクションを増やそう！」`
    ];
    const randomMsg = motivators[Math.floor(Math.random() * motivators.length)];
    document.getElementById("notify-modal-message").innerText = randomMsg;

    // モーダル表示
    const overlay = document.getElementById("notification-overlay");
    overlay.style.display = "flex";

    // 環境音の合成（波の音＋カモメ）
    sound.playOceanAmbiance();
    
    // YouTube等の音量に負けないよう、警告チャイムを3回連続でトリガーして注意を引く！
    sound.playChime();
    setTimeout(() => sound.playChime(), 600);
    setTimeout(() => sound.playChime(), 1200);

    // 音声読み上げ
    speakVoice(speechText);

    // モーダルの「出航ボタン」にタスクIDを紐付け
    const startBtn = document.getElementById("btn-notify-start");
    startBtn.onclick = () => {
        overlay.style.display = "none";
        stopSpeaking();
        startVoyage(sched);
    };

    // スヌーズボタン
    const snoozeBtn = document.getElementById("btn-notify-snooze");
    snoozeBtn.onclick = () => {
        overlay.style.display = "none";
        stopSpeaking();
        if (snoozeTimeoutId) clearTimeout(snoozeTimeoutId);
        snoozeTimeoutId = setTimeout(() => {
            STATE.lastNotifiedTaskId = null; // 再監視できるようにする
        }, 5 * 60 * 1000); // 5分スヌーズ
        updateSecretaryMessage("承知しました、船長。5分間錨を下ろしておきます。少し休憩して準備を整えましょう！");
    };
}













// ==========================================================================
// 7. AI家庭教師「AIコンパス」（Gemini API連携 ＆ プロンプト設計）
// ==========================================================================
// 画像添付の一時保持変数
let selectedImageBase64 = "";
let selectedImageMimeType = "";

async function sendChatMessage() {
    const inputEl = document.getElementById("ai-chat-input");
    const text = inputEl.value.trim();
    if (!text && !selectedImageBase64) return;

    // ユーザーメッセージを追加
    let displayText = text;
    if (selectedImageBase64) {
        displayText = `📷 [写真を送信しました] ` + text;
    }
    appendChatMessage("user", displayText);
    inputEl.value = "";

    // 送信用に画像データをコピーして保持
    const sendImgBase64 = selectedImageBase64;
    const sendImgMime = selectedImageMimeType;

    // プレビュー表示をリセット
    selectedImageBase64 = "";
    selectedImageMimeType = "";
    const imgInput = document.getElementById("ai-image-input");
    if (imgInput) imgInput.value = "";
    const previewContainer = document.getElementById("image-preview-container");
    if (previewContainer) previewContainer.style.display = "none";

    // ローディング中
    const loadingMessageId = appendChatMessage("system", "画像を読み込み、考え中...", true);

    // DOMから直近の対話履歴（過去6件分）を取得してコンテキストを保持
    const chatMessagesEl = document.getElementById("chat-messages");
    const messageEls = chatMessagesEl ? chatMessagesEl.querySelectorAll(".message") : [];
    const chatHistory = [];
    const targetEls = Array.from(messageEls).slice(0, -1).slice(-6); // 最新メッセージ（最後に追加された要素）を除外した直近6件
    targetEls.forEach(el => {
        const isUser = el.classList.contains("user-message");
        const pEl = el.querySelector("p");
        if (pEl) {
            const t = pEl.innerText.trim();
            // プレビュー表示用のメッセージなどを除外してAPIに送る
            if (t && !t.includes("写真がセットされました")) {
                chatHistory.push({
                    role: isUser ? "user" : "model",
                    parts: [{ text: t }]
                });
            }
        }
    });

    try {
        let reply = "";
        if (STATE.geminiApiKey) {
            reply = await fetchGeminiResponse(text, sendImgBase64, sendImgMime, chatHistory);
        } else {
            // APIキーがない場合のデモモード
            if (sendImgBase64) {
                reply = "📷 写真が届きました！写真の中の宿題を読み取るには、保護者画面での「Gemini API キー」の設定が必要です。お父さん・お母さんにキーを設定してもらってね！\n\n※デモ回答のヒント：宿題の画像だね。例えば、数学の足し算・引き算なら、『資源ゲームでのアイテムのやり取り』のように考えてみると分かりやすいよ。まずは一番大きい数から順に計算してみてね！";
            } else {
                reply = generateMockResponse(text);
            }
        }
        
        // ローディングメッセージを消去して実際のメッセージを配置
        removeChatMessage(loadingMessageId);
        appendChatMessage("system", reply);
        
        // 返答を音声で読み上げる（蒼君が画面を読まなくても理解しやすいように）
        speakVoice(reply.substring(0, 100).replace(/\*/g, '') + "（詳しくはチャット画面を見てね）");

    } catch (e) {
        console.error("AIの呼び出しに失敗しました。", e);
        removeChatMessage(loadingMessageId);
        appendChatMessage("system", "申し訳ありません。羅針盤（AI）の調子が悪いようです。APIキーが正しいか確認するか、親御さんにお尋ねください。");
    }
}

// チャット画面へのメッセージ追加
function appendChatMessage(sender, content, isLoading = false) {
    const chatMessagesEl = document.getElementById("chat-messages");
    if (!chatMessagesEl) return "";

    const msgDiv = document.createElement("div");
    const id = "msg-" + Date.now() + Math.random().toString(36).substring(2, 7);
    msgDiv.id = id;
    msgDiv.className = `message ${sender === "user" ? "user-message" : "system-message"}`;
    
    // HTMLエスケープ処理
    let escaped = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Markdownの簡単なパーサー（太字・箇取り・改行）
    let formatted = escaped
        .replace(/\n/g, "<br>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, "<code>$1</code>");

    if (sender === "system" && !isLoading) {
        msgDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; border-bottom:1px dashed rgba(92,78,54,0.15); padding-bottom:2px;">
                <span style="font-size:0.7rem; font-weight:700; color:var(--text-muted);">AIコンパス</span>
                <button class="btn-read-message" style="background:none; border:none; color:var(--gold-dark); cursor:pointer; font-size:0.7rem; display:inline-flex; align-items:center; gap:3px; padding:2px 6px; border-radius:3px;">
                    <i data-lucide="volume-2" style="width:12px; height:12px;"></i> <span>🔊 聞く</span>
                </button>
            </div>
            <p>${formatted}</p>
        `;
        
        // Lucideアイコンの再描画
        setTimeout(() => {
            if (typeof lucide !== "undefined") lucide.createIcons();
        }, 10);
        
        // 読み上げイベント追加
        const readBtn = msgDiv.querySelector(".btn-read-message");
        if (readBtn) {
            readBtn.addEventListener("click", () => {
                const textToRead = msgDiv.querySelector("p").innerText;
                speakVoice(textToRead);
            });
        }
    } else {
        msgDiv.innerHTML = `<p>${formatted}</p>`;
    }

    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    return id;
}

function removeChatMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// デモモード（モック）の応答生成
function generateMockResponse(text) {
    for (const res of MOCK_AI_RESPONSES) {
        for (const kw of res.keywords) {
            if (text.toLowerCase().includes(kw)) {
                return res.answer;
            }
        }
    }
    return "蒼船長、その質問について航路図を調べてみます！\n\n**ステップ1**：大航海時代でも、船のバランスを保つのには計算が必要だったんだ。例えば、知りたいことに一番関係のある『国』や『シミュレーションの資源』をイメージしてみよう。\nもっと具体的に教えてくれる？（数学の計算、英単語、世界の国、などのキーワードを入れると詳しく教えられるよ！）\n\n※親御さんへ：保護者画面でGemini APIキーを設定すると、本物のAI家庭教師がここに常駐して何でも答えてくれるようになります。";
}

// 本物の Gemini API の呼び出し（対話履歴/マルチモーダル対応）
async function fetchGeminiResponse(userQuery, imageBase64 = "", imageMimeType = "", chatHistory = []) {
    const systemInstruction = `あなたは14歳の自閉スペクトラム症（ASD）の中学2年生である「蒼（あおい）君」のスーパー秘書兼、塾の先生「AIコンパス」です。
彼の名前の漢字は「蒼」の1文字ですが、読み方は「あおい」です。彼に対してテキストで語りかけるときは、親しみやすく必ず「あおい君」と呼んでください（「そう君」とは絶対に呼ばないでください）。
蒼君は世界の国やシミュレーションゲーム、工作が大好きで、高い創作意欲を持っています。

宿題（数学、理科、社会、国語、英語など）の質問や、送られてきた宿題の写真に対して、以下の「段階的なヒント教示法」を守って、小学生でもわかりやすい極めてシンプルな言葉で教えてください。

---
【教え方のルール：段階的なヒント教示法】

1. 最初の質問（あるいは新しい画像での質問）：
   - 絶対に最初から「答え（回答そのものや最終計算結果）」を教えないでください。
   - まず問題の内容を優しく整理し、「自分で考えて解くための最初のステップ（ヒント）」だけを1つ提示してください。
   - 小学生でもすんなり理解できる簡単な言葉を使い、情報量は少なくスモールステップにします。

2. 「わからない」「答えは？」などの2回目以降の質問：
   - 会話の履歴（コンテキスト）を見て、すでにヒントを出した後の質問だと判断できる場合、さらに具体的なヒント（部分的な手順や例え）を教えるか、それでも難しそうであれば、ここで初めて「最終的な答え（解説付き）」を優しく丁寧に教えてあげてください。
   - 答えを教えるときは、なぜその答えになるのかを「世界の国々」や「資源ゲーム」などの蒼君の好きな要素に例えて、楽しく分かりやすく解説してください。

3. 常に明るく「〜だよ」「〜だね」「〜してみよう！」と優しくバディのように語りかけ、最後は「ここまではわかったかな？」と問いかけて締めくくってください。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${STATE.geminiApiKey}`;

    // リクエストの contents 配列を構築
    const contents = [];
    
    // 過去のチャット履歴を追加
    chatHistory.forEach(h => {
        contents.push(h);
    });

    // 最新のユーザーメッセージ（画像があればそれも含む）を追加
    const currentParts = [
        { text: userQuery || "添付した画像の問題について教えてください。" }
    ];

    if (imageBase64 && imageMimeType) {
        currentParts.push({
            inlineData: {
                mimeType: imageMimeType,
                data: imageBase64
            }
        });
    }

    contents.push({
        role: "user",
        parts: currentParts
    });

    const requestBody = {
        contents: contents,
        systemInstruction: {
            parts: [
                { text: systemInstruction }
            ]
        },
        generationConfig: {
            temperature: 0.7
        }
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Gemini API Raw Response:", data);
    
    let replyText = "";
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
        replyText = data.candidates[0].content.parts.map(p => p.text || "").join("");
    } else {
        replyText = "AIからの返答データを正しく取得できませんでした。";
    }
    
    console.log("Gemini Parsed Reply Text:", replyText);
    return replyText;
}

// ==========================================================================
// 8. 羅針盤タイマーの制御ロジック
// ==========================================================================
function startVoyage(sched) {
    if (STATE.currentVoyage) {
        clearInterval(STATE.currentVoyage.timerId);
    }

    const now = new Date();
    const [endH, endM] = sched.endTime.split(":").map(Number);
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);
    
    let diffSeconds = Math.floor((endDate - now) / 1000);

    if (diffSeconds <= 0 || diffSeconds > 3600 * 2) {
        diffSeconds = 25 * 60; // デフォルト25分
    }

    STATE.currentVoyage = {
        id: sched.id,
        remainingSeconds: diffSeconds,
        timerId: null
    };

    const compassOuter = document.getElementById("compass-outer");
    if (compassOuter) compassOuter.classList.add("ticking");
    const timerTaskName = document.getElementById("timer-task-name");
    if (timerTaskName) timerTaskName.innerText = sched.title;
    
    sound.playChime();

    STATE.currentVoyage.timerId = setInterval(() => {
        if (!STATE.currentVoyage) return;

        STATE.currentVoyage.remainingSeconds--;

        if (STATE.currentVoyage.remainingSeconds <= 0) {
            completeVoyage();
        } else {
            updateTimerDisplay();
        }
    }, 1000);

    const btnStart = document.getElementById("btn-start-voyage");
    if (btnStart) btnStart.style.display = "none";
    const btnPause = document.getElementById("btn-pause-voyage");
    if (btnPause) btnPause.style.display = "inline-flex";
    const btnComplete = document.getElementById("btn-complete-voyage");
    if (btnComplete) btnComplete.style.display = "inline-flex";

    renderTimeline();
    updateTimerDisplay();

    const country = sched.rewardCountryId === "random"
        ? { name: "ランダム（お楽しみ！）", flag: "🎲" }
        : (COUNTRIES_DATA.find(c => c.id === sched.rewardCountryId) || { name: "未知の国" });
    updateSecretaryMessage(`蒼船長、航海が始まりました！『${sched.title}』を進めましょう。目的地は『${country.name}』の港です！`);
}

function updateTimerDisplay() {
    if (!STATE.currentVoyage) return;

    const mins = Math.floor(STATE.currentVoyage.remainingSeconds / 60);
    const secs = STATE.currentVoyage.remainingSeconds % 60;
    
    const timerCountdown = document.getElementById("timer-countdown");
    if (timerCountdown) {
        timerCountdown.innerText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    
    const needle = document.getElementById("compass-needle");
    if (needle) {
        const progress = STATE.currentVoyage.remainingSeconds % 360;
        needle.style.transform = `rotate(${progress * 6}deg)`;
    }

    const timerStatus = document.getElementById("timer-status-text");
    if (timerStatus) timerStatus.innerText = "順調に航行中...";
}

function completeVoyage() {
    if (!STATE.currentVoyage) return;

    clearInterval(STATE.currentVoyage.timerId);
    const voyageId = STATE.currentVoyage.id;

    const sched = STATE.schedules.find(s => s.id === voyageId);
    if (sched) {
        sched.status = "pending-approval";
    }

    STATE.currentVoyage = null;
    saveState();

    resetCompassTimerUI();
    renderTimeline();
    renderParentApprovalList();

    sound.playFanfare();
    const country = sched && sched.rewardCountryId === "random"
        ? { name: "ランダム（お楽しみ！）" }
        : (COUNTRIES_DATA.find(c => c.id === (sched ? sched.rewardCountryId : "")) || { name: "新しい国" });
    const text = `目的地に到着しました！蒼船長、お疲れ様です。親御さんに入港承認をもらって、${country.name}のパズルをアンロックしましょう！`;
    speakVoice(`目的地に到着したよ。あおい君、お疲れ様。親御さんに入港のサインをもらおう！`);

    updateSecretaryMessage(text);
    alert("🎉 目的地に到着しました！親御さんに『入港承認』のサインをもらいましょう！");
}

function resetCompassTimerUI() {
    const compassOuter = document.getElementById("compass-outer");
    if (compassOuter) compassOuter.classList.remove("ticking");
    const timerTaskName = document.getElementById("timer-task-name");
    if (timerTaskName) timerTaskName.innerText = "停泊中";
    const timerCountdown = document.getElementById("timer-countdown");
    if (timerCountdown) timerCountdown.innerText = "00:00";
    const timerStatus = document.getElementById("timer-status-text");
    if (timerStatus) timerStatus.innerText = "舵を引いて出航してください";
    const needle = document.getElementById("compass-needle");
    if (needle) needle.style.transform = "rotate(0deg)";

    const btnStart = document.getElementById("btn-start-voyage");
    if (btnStart) btnStart.style.display = "inline-flex";
    const btnPause = document.getElementById("btn-pause-voyage");
    if (btnPause) btnPause.style.display = "none";
    const btnComplete = document.getElementById("btn-complete-voyage");
    if (btnComplete) btnComplete.style.display = "none";
}

// ==========================================================================
// 9. イベントリスナーと初期化 (安全ガード付き)
// ==========================================================================
function initEventListeners() {
    // タブの切り替え
    const tabs = document.querySelectorAll(".nav-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const panes = document.querySelectorAll(".tab-pane");
            panes.forEach(p => p.classList.remove("active"));
            const targetPane = document.getElementById(`tab-${tab.dataset.tab}`);
            if (targetPane) targetPane.classList.add("active");

            sound.init();

            if (tab.dataset.tab === "map") {
                setTimeout(() => {
                    renderWorldMap();
                }, 50);
            }
        });
    });

    // サブタブ（世界地図・図鑑の切り替え）
    const subtabs = document.querySelectorAll(".sub-tab");
    subtabs.forEach(stab => {
        stab.addEventListener("click", () => {
            subtabs.forEach(t => t.classList.remove("active"));
            stab.classList.add("active");

            const spanes = document.querySelectorAll(".subtab-pane");
            spanes.forEach(p => p.classList.remove("active"));
            const targetPane = document.getElementById(`subtab-${stab.dataset.subtab}`);
            if (targetPane) targetPane.classList.add("active");

            if (stab.dataset.subtab === "puzzle") {
                setTimeout(() => {
                    renderWorldMap();
                }, 50);
            }
        });
    });

    // 航海タイマーの「手動開始」ボタン
    const btnStartVoyage = document.getElementById("btn-start-voyage");
    if (btnStartVoyage) {
        btnStartVoyage.addEventListener("click", () => {
            sound.init();
            const now = new Date();
            const currentHrsMins = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            let targetTask = STATE.schedules.find(s => s.status === "pending" && currentHrsMins >= s.startTime && currentHrsMins < s.endTime);
            if (!targetTask) {
                targetTask = STATE.schedules.find(s => s.status === "pending");
            }

            if (targetTask) {
                startVoyage(targetTask);
            } else {
                alert("今日の航海予定はすべて完了しているか、登録されていません！");
            }
        });
    }

    // 錨を下ろす（一時停止）
    const btnPauseVoyage = document.getElementById("btn-pause-voyage");
    if (btnPauseVoyage) {
        btnPauseVoyage.addEventListener("click", () => {
            if (STATE.currentVoyage) {
                clearInterval(STATE.currentVoyage.timerId);
                STATE.currentVoyage = null;
                resetCompassTimerUI();
                updateSecretaryMessage("錨を下ろして一時停止しました。準備ができたら再度出航しましょう！");
            }
        });
    }

    // 目的地到着（完了）
    const btnCompleteVoyage = document.getElementById("btn-complete-voyage");
    if (btnCompleteVoyage) {
        btnCompleteVoyage.addEventListener("click", () => {
            completeVoyage();
        });
    }

    // 創作キャラクター追加フォーム
    const formCreateCharacter = document.getElementById("form-create-character");
    if (formCreateCharacter) {
        formCreateCharacter.addEventListener("submit", (e) => {
            e.preventDefault();
            const nameInput = document.getElementById("char-name");
            const descInput = document.getElementById("char-desc");
            const typeSelect = document.getElementById("char-type");

            const newChar = {
                name: nameInput.value.trim(),
                desc: descInput.value.trim(),
                type: typeSelect.value
            };

            STATE.createdCharacters.push(newChar);
            saveState();
            renderCreatedCharacters();

            if (nameInput) nameInput.value = "";
            if (descInput) descInput.value = "";

            sound.playChime();
            alert(`🎨 オリジナル創作「${newChar.name}」がコレクションに追加されました！`);
        });
    }

    // チャット送信
    const btnSendChat = document.getElementById("btn-send-chat");
    if (btnSendChat) {
        btnSendChat.addEventListener("click", sendChatMessage);
    }
    const aiChatInput = document.getElementById("ai-chat-input");
    if (aiChatInput) {
        aiChatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // 親用：スケジュール追加・編集フォーム
    const formAddSchedule = document.getElementById("form-add-schedule");
    if (formAddSchedule) {
        formAddSchedule.addEventListener("submit", (e) => {
            e.preventDefault();
            const titleInput = document.getElementById("sched-title");
            const startInput = document.getElementById("sched-start");
            const endInput = document.getElementById("sched-end");
            const rewardSelect = document.getElementById("sched-reward");

            if (STATE.editingScheduleId) {
                // 編集モード
                const sched = STATE.schedules.find(s => s.id === STATE.editingScheduleId);
                if (sched) {
                    sched.title = titleInput.value.trim();
                    sched.startTime = startInput.value;
                    sched.endTime = endInput.value;
                    sched.rewardCountryId = rewardSelect.value;
                    
                    const timerTaskName = document.getElementById("timer-task-name");
                    if (STATE.currentVoyage && STATE.currentVoyage.id === sched.id && timerTaskName) {
                        timerTaskName.innerText = sched.title;
                    }
                    
                    alert(`📅 航路「${sched.title}」の変更を保存しました。`);
                }
                STATE.editingScheduleId = null;
                const submitBtn = document.getElementById("btn-add-schedule-submit");
                if (submitBtn) {
                    submitBtn.innerHTML = `<i data-lucide="plus-circle"></i> 予定を追加`;
                }
                const cancelBtn = document.getElementById("btn-cancel-edit-schedule");
                if (cancelBtn) {
                    cancelBtn.style.display = "none";
                }
            } else {
                // 新規追加
                const newSched = {
                    id: "sched-" + Date.now(),
                    title: titleInput.value.trim(),
                    startTime: startInput.value,
                    endTime: endInput.value,
                    rewardCountryId: rewardSelect.value,
                    status: "pending"
                };

                STATE.schedules.push(newSched);
                alert(`📅 航路「${newSched.title}」を追加しました。`);
            }

            saveState();
            renderTimeline();
            renderParentSchedule();

            if (titleInput) titleInput.value = "";
            if (startInput) startInput.value = "";
            if (endInput) endInput.value = "";
            if (typeof lucide !== "undefined") lucide.createIcons();
        });
    }

    // 親用：APIキーの保存
    const btnSaveKey = document.getElementById("btn-save-key");
    if (btnSaveKey) {
        btnSaveKey.addEventListener("click", () => {
            const keyInput = document.getElementById("input-gemini-key");
            const key = keyInput ? keyInput.value.trim() : "";
            if (key.startsWith("AIzaSy") || key === "") {
                STATE.geminiApiKey = key;
                saveState();
                updateAiKeyBadge();
                alert("🔑 Gemini API キーを設定しました。");
            } else if (key === "••••••••••••••••••••••••") {
                alert("APIキーはすでに保存されています。");
            } else {
                alert("有効なGemini APIキーの形式（AIzaSyから始まる）ではありません。確認してください。");
            }
        });
    }

    // 親用：APIキーの消去
    const btnClearKey = document.getElementById("btn-clear-key");
    if (btnClearKey) {
        btnClearKey.addEventListener("click", () => {
            if (confirm("保存されているAPIキーを削除しますか？")) {
                STATE.geminiApiKey = "";
                saveState();
                updateAiKeyBadge();
                alert("APIキーを消去しました。AI家庭教師はデモモードに戻ります。");
            }
        });
    }

    // テスト：わくわく通知の手動トリガー
    const btnTestNotification = document.getElementById("btn-test-notification");
    if (btnTestNotification) {
        btnTestNotification.addEventListener("click", () => {
            sound.init();
            let target = STATE.schedules[0];
            if (!target) {
                target = { id: "test", title: "テスト勉強 of 海域", startTime: "14:00", endTime: "15:00", rewardCountryId: "france", status: "pending" };
            }
            STATE.lastNotifiedTaskId = null;
            triggerVoyageNotification(target);
        });
    }

    // テスト：データリセット
    const btnResetData = document.getElementById("btn-reset-data");
    if (btnResetData) {
        btnResetData.addEventListener("click", () => {
            if (confirm("すべての設定、スケジュール、アンロックしたパズル、ゴールドを消去してアプリをリセットしますか？この操作は戻せません。")) {
                localStorage.removeItem("blue_voyage_state");
                STATE = {
                    level: 1,
                    xp: 0,
                    coins: 0,
                    unlockedCountries: ["japan"],
                    createdCharacters: [],
                    schedules: [...DEFAULT_SCHEDULES],
                    pendingApprovals: [],
                    geminiApiKey: "",
                    currentVoyage: null,
                    lastNotifiedTaskId: null,
                    syncGasUrl: "",
                    isParentDevice: true
                };
                saveState();
                location.reload();
            }
        });
    }

    // 🧩 世界地図パズルの地域フィルター切り替え
    const filterTabs = document.querySelectorAll(".filter-tab");
    filterTabs.forEach(ftab => {
        ftab.addEventListener("click", () => {
            filterTabs.forEach(t => t.classList.remove("active"));
            ftab.classList.add("active");
            currentRegionFilter = ftab.dataset.region;
            renderWorldMap();
        });
    });

    // 🪙 親用：ご褒美追加フォームの送信
    const addRewardForm = document.getElementById("form-add-reward");
    if (addRewardForm) {
        addRewardForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const nameIn = document.getElementById("reward-name");
            const priceIn = document.getElementById("reward-price");
            const iconIn = document.getElementById("reward-icon");

            const newReward = {
                id: "reward-" + Date.now(),
                name: nameIn.value.trim(),
                price: parseInt(priceIn.value),
                icon: iconIn.value
            };

            STATE.shopRewards.push(newReward);
            saveState();
            renderShopGoods();
            renderParentRewardsList();

            if (nameIn) nameIn.value = "";
            if (priceIn) priceIn.value = "500";
            alert(`🎁 ご褒美「${newReward.name}」を追加しました。`);
        });
    }

    // 🎰 ガチャボタンの接続
    const gachaBtn = document.getElementById("btn-spin-gacha");
    if (gachaBtn) {
        gachaBtn.addEventListener("click", () => {
            spinGacha();
        });
    }

    // 📷 宿題写真の添付 ＆ プレビュー処理
    const imageInput = document.getElementById("ai-image-input");
    const previewContainer = document.getElementById("image-preview-container");
    const previewImg = document.getElementById("image-preview");
    const removePreviewBtn = document.getElementById("btn-remove-preview");

    if (imageInput) {
        imageInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    selectedImageBase64 = event.target.result.split(",")[1];
                    selectedImageMimeType = file.type;

                    if (previewImg) previewImg.src = event.target.result;
                    if (previewContainer) previewContainer.style.display = "block";
                    updateSecretaryMessage("宿題の写真がセットされました！質問を入力するか、そのまま送信してください。");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (removePreviewBtn) {
        removePreviewBtn.addEventListener("click", () => {
            selectedImageBase64 = "";
            selectedImageMimeType = "";
            if (imageInput) imageInput.value = "";
            if (previewContainer) previewContainer.style.display = "none";
        });
    }

    // 🔄 同期設定の保存
    const syncSaveBtn = document.getElementById("btn-save-sync");
    const syncGasInput = document.getElementById("input-sync-gas");
    const syncNowBtn = document.getElementById("btn-sync-now");
    const checkboxParent = document.getElementById("checkbox-parent-device");

    if (syncSaveBtn && syncGasInput) {
        syncSaveBtn.addEventListener("click", async () => {
            const url = syncGasInput.value.trim();
            
            if (url && url.includes("google.com")) {
                STATE.syncGasUrl = url;
                STATE.isParentDevice = checkboxParent ? checkboxParent.checked : true;
                saveState(true); // クラウドへのプッシュをスキップしてプルを優先！
                updateSyncUI();
                
                alert(`🔄 Googleスプレッドシート（GAS）同期を設定しました。クラウドデータを同期します...`);
                await pullStateFromCloud();
                
                if (window.syncTimerId) clearInterval(window.syncTimerId);
                window.syncTimerId = setInterval(pullStateFromCloud, 10000);
            } else {
                STATE.syncGasUrl = "";
                saveState();
                updateSyncUI();
                if (window.syncTimerId) {
                    clearInterval(window.syncTimerId);
                    window.syncTimerId = null;
                }
                alert("同期を解除し、ローカルモードに戻しました。");
            }
        });
    }

    if (syncNowBtn) {
        syncNowBtn.addEventListener("click", async () => {
            syncNowBtn.disabled = true;
            syncNowBtn.innerHTML = `<i data-lucide="refresh-cw" class="icon-pulse"></i> 同期中...`;
            if (typeof lucide !== "undefined") lucide.createIcons();
            
            await pushStateToCloud(); // 読み込み・マージ後プッシュ
            await pullStateFromCloud(); // 最新状態のプル
            
            syncNowBtn.disabled = false;
            syncNowBtn.innerHTML = `<i data-lucide="refresh-cw"></i> 今すぐ同期`;
            if (typeof lucide !== "undefined") lucide.createIcons();
            alert("Googleスプレッドシートとのスマート同期が完了しました！");
        });
    }

    // === 音声コントロールUIのイベントリスナー ===
    const speedSlider = document.getElementById("voice-speed-slider");
    const speedValue = document.getElementById("voice-speed-value");
    const btnStopVoice = document.getElementById("btn-stop-voice");
    const btnReadSelection = document.getElementById("btn-read-selection");

    if (speedSlider && speedValue) {
        const savedSpeed = STATE.voiceSpeed || 0.95;
        speedSlider.value = savedSpeed;
        speedValue.innerText = `${savedSpeed.toFixed(2)}x`;

        speedSlider.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            speedValue.innerText = `${val.toFixed(2)}x`;
            STATE.voiceSpeed = val;
            saveState();
        });
    }

    if (btnStopVoice) {
        btnStopVoice.addEventListener("click", () => {
            stopSpeaking();
            updateSecretaryMessage("読み上げを停止しました。");
        });
    }

    document.addEventListener("selectionchange", () => {
        const selected = window.getSelection().toString().trim();
        if (selected) {
            if (selectionClearTimeout) {
                clearTimeout(selectionClearTimeout);
                selectionClearTimeout = null;
            }
            lastSelectedText = selected;
        } else {
            if (!selectionClearTimeout) {
                selectionClearTimeout = setTimeout(() => {
                    lastSelectedText = "";
                    selectionClearTimeout = null;
                }, 300);
            }
        }
    });

    if (btnReadSelection) {
        btnReadSelection.addEventListener("click", () => {
            sound.init();
            const selection = window.getSelection().toString().trim() || lastSelectedText;
            if (selection) {
                speakVoice(selection);
                updateSecretaryMessage("選択した範囲を読み上げています...");
            } else {
                alert("💡 使い方：\n画面上の文章をマウスのドラッグ（またはスマホ・iPadなら指で長押し）して、読みたい部分を「青く選択」してからこのボタンを押してね！");
            }
        });
    }
}

// ==========================================================================
// 10. クラウド同期処理 (Google Apps Script / スプレッドシート 連携)
// ==========================================================================

// 配列の重複排除マージヘルパー
function mergeArrays(arr1, arr2) {
    const combined = (arr1 || []).concat(arr2 || []);
    const unique = [];
    for (let i = 0; i < combined.length; i++) {
        if (unique.indexOf(combined[i]) === -1) {
            unique.push(combined[i]);
        }
    }
    return unique;
}

// 親機・子機でのスマートマージ（差分結合）ロジック
function mergeState(local, cloud, isParent) {
    if (!cloud || !cloud.schedules) {
        return local; // クラウドにデータがなければローカルをそのまま使う
    }

    const merged = { ...cloud }; // 基本はクラウドのデータをベースにする

    if (isParent) {
        // 親機（PC）がマージする場合：
        // 1. スケジュール（タスク）リスト自体は親（ローカル）が絶対
        // ただし、各タスクの「進行ステータス」は、子（クラウド）が更新した進捗を引き継ぐ
        merged.schedules = local.schedules.map(ls => {
            const cs = cloud.schedules.find(s => s.id === ls.id);
            if (cs) {
                return { ...ls, status: cs.status }; // 親の設定に、子のステータスをマージ
            }
            return ls;
        });

        // 2. ご褒美ショップリストは親（ローカル）が絶対
        merged.shopRewards = local.shopRewards;

        // 3. 子の進捗データ（コイン、XP、レベル、パズル、創作キャラ、交換申請）はクラウド（子）を引き継ぐ
        merged.level = cloud.level;
        merged.xp = cloud.xp;
        merged.coins = cloud.coins;
        merged.unlockedCountries = cloud.unlockedCountries;
        merged.placedCountries = cloud.placedCountries;
        merged.createdCharacters = cloud.createdCharacters;
        merged.rewardExchanges = cloud.rewardExchanges;
        merged.pendingApprovals = cloud.pendingApprovals;
        merged.geminiApiKey = local.geminiApiKey; // APIキーは各端末固有
    } else {
        // 子機（iPad）がマージする場合：
        // 1. スケジュールリストやご褒美は、親（クラウド）が絶対
        // ただし、自分が今実行中のタイマーがあれば、そのステータスはローカルを優先
        merged.schedules = cloud.schedules.map(cs => {
            const ls = local.schedules.find(s => s.id === cs.id);
            if (ls && local.currentVoyage && local.currentVoyage.id === cs.id) {
                return { ...cs, status: ls.status }; // 実行中タイマーのステータスを維持
            }
            return cs;
        });
        merged.shopRewards = cloud.shopRewards;

        // 2. 進捗データは、子（ローカル）が絶対。
        // ただし！ローカルが「初期リセット状態（0コイン、1レベル）」の場合は、クラウド上の既存進捗をそのまま引き継ぐ！
        if (local.coins === 0 && local.xp === 0 && local.level === 1 && local.unlockedCountries.length === 1 && local.unlockedCountries[0] === "japan") {
            merged.level = cloud.level;
            merged.xp = cloud.xp;
            merged.coins = cloud.coins;
            merged.unlockedCountries = cloud.unlockedCountries;
            merged.placedCountries = cloud.placedCountries;
        } else {
            // 双方が独自にデータを持っている場合は、大きい値（または合算）を優先してデータ消失を防ぐ
            merged.level = Math.max(local.level, cloud.level);
            merged.xp = Math.max(local.xp, cloud.xp);
            merged.coins = Math.max(local.coins, cloud.coins);
            merged.unlockedCountries = mergeArrays(local.unlockedCountries, cloud.unlockedCountries);
            merged.placedCountries = mergeArrays(local.placedCountries, cloud.placedCountries);
        }

        // 創作キャラ、交換申請などのコレクションは消さずに合算マージ
        const combinedChars = (local.createdCharacters || []).concat(cloud.createdCharacters || []);
        const uniqueChars = [];
        const seenCharNames = {};
        for (let i = 0; i < combinedChars.length; i++) {
            const char = combinedChars[i];
            if (char && char.name && !seenCharNames[char.name]) {
                seenCharNames[char.name] = true;
                uniqueChars.push(char);
            }
        }
        merged.createdCharacters = uniqueChars;
        merged.rewardExchanges = mergeArrays(local.rewardExchanges, cloud.rewardExchanges);
        merged.pendingApprovals = mergeArrays(local.pendingApprovals, cloud.pendingApprovals);
        merged.geminiApiKey = local.geminiApiKey; // APIキーは各端末固有
    }

    return merged;
}

function updateSyncUI() {
    const syncGasInput = document.getElementById("input-sync-gas");
    const syncStatus = document.getElementById("sync-status");
    const syncNowBtn = document.getElementById("btn-sync-now");
    const checkboxParent = document.getElementById("checkbox-parent-device");

    if (!syncGasInput) return;

    if (STATE.syncGasUrl) {
        syncGasInput.value = STATE.syncGasUrl;
        syncStatus.innerHTML = `<span style="color: var(--success); font-weight: 700;"><i data-lucide="wifi" style="width:12px; height:12px;"></i> スプレッドシート同期中</span>`;
        syncNowBtn.style.display = "inline-flex";
        if (checkboxParent) {
            checkboxParent.checked = !!STATE.isParentDevice;
        }
    } else {
        syncGasInput.value = "";
        syncStatus.innerHTML = `<span style="color: var(--text-muted);">同期状態: 未接続 (ローカルのみ)</span>`;
        syncNowBtn.style.display = "none";
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
}

function applyCloudDataToLocal(cloudData) {
    if (!cloudData) return;

    // クラウドデータとローカルデータをスマートマージする
    const merged = mergeState(STATE, cloudData, STATE.isParentDevice);

    STATE.level = merged.level;
    STATE.xp = merged.xp;
    STATE.coins = merged.coins;
    STATE.unlockedCountries = merged.unlockedCountries;
    STATE.placedCountries = merged.placedCountries;
    STATE.createdCharacters = merged.createdCharacters;
    STATE.shopRewards = merged.shopRewards;
    STATE.rewardExchanges = merged.rewardExchanges;
    STATE.pendingApprovals = merged.pendingApprovals;
    STATE.schedules = merged.schedules;

    renderHeader();
    renderTimeline();
    renderWorldMap();
    renderDiscoveredCountries();
    renderCreatedCharacters();
    renderParentSchedule();
    renderParentApprovalList();
    renderParentRewardsList();
    renderParentExchangeList();
    renderShopGoods();

    // ローカルストレージにのみ保存
    saveState(true);
}

function showSyncLog(msg, type) {
    const logEl = document.getElementById("sync-log-message");
    if (!logEl) return;
    logEl.style.display = "block";
    logEl.innerText = msg;
    if (type === "success") {
        logEl.style.backgroundColor = "rgba(46, 204, 113, 0.1)";
        logEl.style.color = "#2ecc71";
        logEl.style.borderColor = "rgba(46, 204, 113, 0.2)";
    } else if (type === "error") {
        logEl.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
        logEl.style.color = "#e74c3c";
        logEl.style.borderColor = "rgba(231, 76, 60, 0.2)";
    } else {
        logEl.style.backgroundColor = "rgba(52, 152, 219, 0.1)";
        logEl.style.color = "#3498db";
        logEl.style.borderColor = "rgba(52, 152, 219, 0.2)";
    }
}

async function pushStateToCloud() {
    if (!STATE.syncGasUrl) return;
    showSyncLog("📤 同期データをクラウドへ送信中...", "info");

    const payload = {
        state: {
            level: STATE.level,
            xp: STATE.xp,
            coins: STATE.coins,
            unlockedCountries: STATE.unlockedCountries,
            placedCountries: STATE.placedCountries,
            createdCharacters: STATE.createdCharacters,
            schedules: STATE.schedules.map(s => ({ ...s, timerId: null })),
            shopRewards: STATE.shopRewards,
            rewardExchanges: STATE.rewardExchanges,
            pendingApprovals: STATE.pendingApprovals
        },
        isParent: !!STATE.isParentDevice
    };

    try {
        const response = await fetch(STATE.syncGasUrl, {
            method: "POST",
            body: JSON.stringify(payload),
            redirect: "follow"
        });
        if (response.ok) {
            console.log("クラウドへのデータプッシュに成功しました。");
            const resText = await response.text(); // text() で受けることでCORS問題を回避
            const resData = JSON.parse(resText);
            if (resData && resData.status === "success" && resData.data) {
                applyCloudDataToLocal(resData.data);
            }
            showSyncLog("🟢 送信＆スマートマージに成功！ (" + new Date().toLocaleTimeString() + ")", "success");
        } else {
            showSyncLog("❌ 送信失敗。ステータスコード: " + response.status, "error");
        }
    } catch (e) {
        showSyncLog("🔴 送信エラー: " + e.toString(), "error");
        console.error("スプレッドシートへのプッシュに失敗しました。", e);
    }
}

let isSyncing = false;
async function pullStateFromCloud() {
    if (!STATE.syncGasUrl || isSyncing) return;
    isSyncing = true;
    showSyncLog("📥 クラウドから最新データを受信中...", "info");

    try {
        // GET ではなく、POST メソッドで action: "read" を送信してCORS/リダイレクト制限をすり抜ける！
        const response = await fetch(STATE.syncGasUrl, {
            method: "POST",
            body: JSON.stringify({ action: "read" }),
            redirect: "follow"
        });
        if (response.ok) {
            const resText = await response.text();
            const resData = JSON.parse(resText);
            
            if (resData && resData.status === "success" && resData.data) {
                const cloudData = resData.data;
                if (cloudData && cloudData.schedules) {
                    applyCloudDataToLocal(cloudData);
                    showSyncLog("🟢 同期受信＆反映に成功しました！ (" + new Date().toLocaleTimeString() + ")", "success");
                } else {
                    showSyncLog("⚠️ 受信データにタスク情報(schedules)がありませんでした。", "error");
                }
            } else {
                showSyncLog("⚠️ 受信データの解析に失敗しました。", "error");
            }
        } else {
            showSyncLog("❌ 受信失敗。ステータスコード: " + response.status, "error");
        }
    } catch (e) {
        showSyncLog("🔴 受信エラー: " + e.toString(), "error");
        console.error("スプレッドシートからのプル同期に失敗しました。", e);
    } finally {
        isSyncing = false;
    }
}

// 起動時に同期が設定されていれば自動同期を開始
if (STATE.syncGasUrl) {
    pullStateFromCloud();
    window.syncTimerId = setInterval(pullStateFromCloud, 10000);
}

// 音声読み上げ
function speakVoice(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // 既存の音声をクリア
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = STATE.voiceSpeed || 0.95; // 読み上げ速度
        utterance.pitch = 1.05; // 明るめのトーン

        const voices = window.speechSynthesis.getVoices();
        const targetVoice = 
            voices.find(v => v.lang.startsWith("ja") && v.name.includes("Google")) ||
            voices.find(v => v.lang.startsWith("ja") && (v.name.includes("Siri") || v.name.includes("Kyoko") || v.name.includes("Otoya"))) ||
            voices.find(v => v.lang.startsWith("ja") && (v.name.includes("Nanami") || v.name.includes("Ichiro") || v.name.includes("Sayaka"))) ||
            voices.find(v => v.lang.startsWith("ja"));

        if (targetVoice) {
            utterance.voice = targetVoice;
        }

        window.speechSynthesis.speak(utterance);
    }
}

function stopSpeaking() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
}
