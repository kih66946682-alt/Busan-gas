// 오피넷에서 부산 휘발유 최저가 주유소를 받아 data/prices.json 으로 저장합니다.
import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.OPINET_API_KEY;
if (!KEY) {
  console.error("OPINET_API_KEY 가 설정되지 않았어요. GitHub Secrets를 확인하세요.");
  process.exit(1);
}

const BASE = "https://www.opinet.co.kr/api";
const BRANDS = {
  SKE: "SK에너지",
  GSC: "GS칼텍스",
  HDO: "현대오일뱅크",
  SOL: "S-OIL",
  RTE: "자영알뜰",
  RTX: "고속도로알뜰",
  NHO: "농협알뜰",
  E1G: "E1",
  SKG: "SK가스",
  ETC: "자가상표",
};

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 형식이 아니에요: ${text.slice(0, 200)}`);
  }
}

// 1) 부산의 지역 코드를 오피넷에서 찾기 (못 찾으면 10번 사용)
let areaCode = "10";
try {
  const area = await getJson(`${BASE}/areaCode.do?out=json&code=${KEY}`);
  const busan = (area?.RESULT?.OIL ?? []).find((a) => a.AREA_NM?.includes("부산"));
  if (busan) areaCode = busan.AREA_CD;
} catch (e) {
  console.warn("지역 코드 조회 실패, 기본값 10 사용:", e.message);
}
console.log("부산 지역 코드:", areaCode);

// 2) 부산 휘발유(B027) 최저가 주유소 20곳 받기
const data = await getJson(
  `${BASE}/lowTop10.do?out=json&code=${KEY}&prodcd=B027&area=${areaCode}&cnt=20`
);
const list = data?.RESULT?.OIL ?? [];
if (list.length === 0) {
  console.error("주유소 데이터가 비어 있어요. 응답:", JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

// 3) 싼 순으로 정리해서 저장
const stations = list
  .map((s) => ({
    name: s.OS_NM,
    brand: BRANDS[s.POLL_DIV_CD] ?? "기타",
    price: Number(s.PRICE),
    address: s.NEW_ADR || s.VAN_ADR || "",
  }))
  .sort((a, b) => a.price - b.price);

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/prices.json",
  JSON.stringify({ updated: new Date().toISOString(), stations }, null, 2)
);
console.log(`완료: 주유소 ${stations.length}곳 저장`);
