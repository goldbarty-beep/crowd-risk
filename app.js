async function load() {
  const res = await fetch("./data/latest.json", { cache: "no-store" });
  const data = await res.json();

  // 임시 출력 (나중에 혼잡도 → 확률로 바꿈)
  document.getElementById("result").innerText =
    "오늘 가면 깔려죽을 확률 78% (체감)";
}
