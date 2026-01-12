let PLACES_CACHE = null;

/* =========================
   [A] 서울시 실시간 도시데이터 API (OA-21778) 호출 함수 추가
   ========================= */
async function fetchSeoulCitydataPpltn(place) {
  const API_KEY = "SEOUL_API_KEY"; // TODO: 발급키로 교체
  const url =
    `https://openapi.seoul.go.kr:8088/${API_KEY}/json/citydata_ppltn/1/5/` +
    encodeURIComponent(place);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`서울 OpenAPI 실패: ${res.status}`);

  return await res.json();
}

function deepFind(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const k of Object.keys(obj)) {
    const v = deepFind(obj[k], key);
    if (v !== undefined) return v;
  }
  return undefined;
}

async function getCongestionFor(place) {
  const data = await fetchSeoulCitydataPpltn(place);

  const lvl = deepFind(data, "AREA_CONGEST_LVL"); // 혼잡도 레벨/문구
  const msg = deepFind(data, "AREA_CONGEST_MSG"); // 혼잡 메시지

  return { place, lvl, msg, raw: data };
}

// ✅ (선택) 첫 로드시 콘솔 테스트 원하면 유지, 싫으면 주석처리
// getCongestionFor("강남역").then(console.log).catch(console.error);

document.getElementById("searchBtn").addEventListener("click", () => {
  const q = document.getElementById("q").value.trim();
  if (q) showByQuery(q);
});
document.getElementById("refreshBtn").addEventListener("click", async () => {
  await loadPlaces(true);
  renderPlaceButtons();
});

async function loadPlaces(force = false) {
  if (PLACES_CACHE && !force) return PLACES_CACHE;

  // 캐시 무력화
  const res = await fetch("./data/places.json?v=" + Date.now(), { cache: "no-store" });
  const data = await res.json();
  PLACES_CACHE = data;
  return data;
}

function normalize(s) {
  return (s ?? "").toString().replace(/\s+/g, "").toLowerCase();
}

// 사용자가 "강남" 치면 "강남역" 같은 식으로 어느 정도 보정(원하면 확장 가능)
function aliasQuery(q) {
  const n = normalize(q);
  const map = {
    "강남": "강남역",
    "홍대": "홍대입구역",
    "홍대입구": "홍대입구역",
    "건대": "건대입구역",
    "잠실": "잠실 관광특구"
  };
  return map[n] || q;
}

async function renderPlaceButtons() {
  const wrap = document.getElementById("places");
  wrap.innerHTML = "불러오는 중…";

  const data = await loadPlaces();
  const items = (data.items || []).filter(x => x && x.place);

  // 버튼 렌더
  wrap.innerHTML = "";
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "place-btn";
    btn.textContent = item.place;

    // ✅ showItem이 async로 바뀜
    btn.addEventListener("click", async () => showItem(item));

    wrap.appendChild(btn);
  });

  // 메타
  document.getElementById("meta").innerText =
    data.updated ? `업데이트: ${data.updated}` : "";
}

function mapCongestionToRate(level) {
  const raw = (level ?? "").toString().trim();
  const s = raw.replace(/\s+/g, "");

  // 숫자 레벨이 오면 대비
  const n = Number(s);
  if (!Number.isNaN(n)) {
    // ⚠️ 여기 때문에 5% 고정이 자주 생김
    // 서울시 도시데이터의 AREA_CONGEST_LVL이 1~4인데 의미가 반대(1=여유)인지(1=혼잡)인지 확인 필요
    // 일단 네 기존 로직 유지. 만약 항상 5%면 아래를 "뒤집기"로 바꿔.
    if (n <= 1) return 5;
    if (n === 2) return 30;
    if (n === 3) return 65;
    return 85;
  }

  // 문자열 대비(혼잡/붐빔/원활/한산 등)
  if (s.includes("매우") && (s.includes("혼잡") || s.includes("붐빔"))) return 85;
  if (s.includes("혼잡") || s.includes("붐빔")) return 65;
  if (s.includes("보통") || s.includes("약간")) return 30;
  if (s.includes("여유") || s.includes("원활") || s.includes("한산")) return 5;

  return 50;
}

function pickMessage(level) {
  const s = (level ?? "").toString();
  const rate = mapCongestionToRate(s);

  if (rate >= 85) return rand(["오늘은 집이 답", "인성 테스트 구간", "깔려죽을 확률 체감 MAX"]);
  if (rate >= 65) return rand(["팔꿈치 방패 장착 권장", "오늘은 이동이 아니라 밀림", "약속 잡은 친구 원망 가능"]);
  if (rate >= 30) return rand(["어깨 부딪힘은 각오", "데이트는 가능, 인내심 필요", "적당히 북적"]);
  return rand(["사람보다 바람이 더 많음", "오늘은 산책 가능", "숨 쉴 확률 매우 높음"]);
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================
   [B] 핵심: showItem에서 실시간 API로 congestion 덮어쓰기
   ========================= */
async function showItem(item) {
  const place = item.place;

  // 기본값(places.json)
  let congestion = item.congestion ?? "알수없음";
  let msg = item.msg ?? "";

  // ✅ 실시간 조회해서 덮어쓰기
  try {
    const live = await getCongestionFor(place);

    // 디버그: 실제로 뭐가 오는지 보면 5% 고정 원인 바로 나옴
    console.log("[LIVE]", place, "lvl=", live.lvl, "msg=", live.msg);

    if (live.lvl !== undefined && live.lvl !== null && String(live.lvl).trim() !== "") {
      congestion = live.lvl;
      msg = live.msg || "실시간";
    } else {
      msg = (msg ? msg + " / " : "") + "실시간 값 없음";
    }
  } catch (e) {
    console.warn("[LIVE ERROR]", e);
    msg = (msg ? msg + " / " : "") + "실시간 조회 실패";
  }

  const rate = mapCongestionToRate(congestion);
  const line = pickMessage(congestion);

  document.getElementById("result").innerHTML = `
    <p class="big"><strong>${place}</strong> 오늘 가면 깔려죽을 확률 <strong>${rate}%</strong> (체감)</p>
    <div>${line}</div>
    <div class="muted" style="margin-top:10px;">
      혼잡도: ${congestion}${msg ? " / " + msg : ""}<br>
      ※ 본 수치는 공공데이터 혼잡도를 기반으로 한 체감 지수이며 실제 사고 확률과 무관합니다.
    </div>
  `;
}

async function showByQuery(q) {
  const data = await loadPlaces();
  const items = data.items || [];

  const fixed = aliasQuery(q);
  const target = items.find(x => normalize(x.place) === normalize(fixed));

  if (!target) {
    document.getElementById("result").innerHTML = `
      <p class="big"><strong>${q}</strong> 는 목록에 없어요.</p>
      <div class="muted">목록에 있는 장소명으로 클릭하거나, 정확히 입력해줘 (예: 강남역, 홍대입구역).</div>
    `;
    return;
  }

  // ✅ showItem이 async
  await showItem(target);
}

// 초기 로드
renderPlaceButtons();

document.getElementById("checkLiveBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("./data/places.json?v=" + Date.now(), { cache: "no-store" });
    const data = await res.json();

    if (!data.updated) {
      alert("업데이트 시간을 확인할 수 없습니다.");
      return;
    }

    const updatedAt = new Date(data.updated);
    const now = new Date();

    const diffMs = now - updatedAt;
    const diffMin = Math.floor(diffMs / 1000 / 60);

    let message = "";

    if (diffMin <= 5) {
      message = `✅ 최신 데이터입니다.\n(${diffMin}분 전 업데이트)`;
    } else if (diffMin <= 15) {
      message = `⚠️ 약간 이전 데이터입니다.\n(${diffMin}분 전 업데이트)`;
    } else {
      message = `❗ 오래된 데이터입니다.\n(${diffMin}분 전 업데이트)\n잠시 후 다시 확인하세요.`;
    }

    alert(message);
  } catch (e) {
    alert("데이터를 확인할 수 없습니다.");
  }
});
