# Lost Item Finder 작업 가이드라인 (AI & 개발자)

## 목적과 범위
이 문서는 `Lost-Item-Finder` 저장소에 대해 AI 에이전트가 작업할 때 따라야 할 규칙과 제약을 정의한 기준 문서다.

**Lost Item Finder**는 AI 기반 분실물 매칭 서비스로, 습득자가 사진을 찍어 올리면 AI가 자동으로 특징을 추출·벡터화하고, 분실자가 자연어 또는 이미지로 검색하면 유사도가 높은 습득물을 찾아주는 졸업설계 프로젝트다.

---

## GitHub 레포지토리
- **URL**: https://github.com/dh2906/Lost-Item-Finder
- **기본 브랜치**: `main`
- **운영 중인 사이트**: ngrok 터널 (로컬 호스팅)

---

## 빌드 / 실행 명령어

```bash
# 의존성 설치
npm install

# DB 컨테이너 실행 (PostgreSQL + pgvector)
docker-compose up -d

# DB 스키마 반영
npm run db:push

# 개발 서버 실행 (클라이언트 + 서버 동시)
npm run dev

# 빌드
npm run build
```

### Drizzle 마이그레이션
```bash
# 스키마 변경 후 DB 반영
npm run db:push

# 마이그레이션 파일 생성
npm run db:generate
```

---

## 프로젝트 구조

- 엔트리 포인트: `server/index.ts`
- 클라이언트 루트: `client/src/`

```
Lost-Item-Finder/
├── client/src/
│   ├── pages/          # home, search, report, item-detail, login, register
│   ├── components/     # 공통 UI 컴포넌트
│   ├── hooks/          # 커스텀 훅
│   └── lib/            # 유틸리티
├── server/
│   ├── routes.ts       # API 엔드포인트 + AI 파이프라인 (핵심)
│   ├── storage.ts      # DB 접근 레이어
│   ├── auth.ts         # Passport.js 인증 설정
│   ├── db.ts           # DB 연결
│   └── utils/          # 서버 유틸리티
├── shared/
│   ├── schema.ts       # DB 스키마 (Drizzle + Zod 타입)
│   └── routes.ts       # 클라이언트-서버 공유 API 타입/경로
├── docker/             # PostgreSQL init SQL
├── docs/               # 문서
└── docker-compose.yml  # DB 컨테이너 설정
```

---

## 기술 스택

| 분류 | 기술 |
|---|---|
| Language | TypeScript (전체 97.5%) |
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js |
| ORM | Drizzle ORM |
| DB | PostgreSQL + pgvector (벡터 검색) |
| AI — 임베딩 | OpenAI text-embedding-3-small (1536차원) |
| AI — 이미지 분석 | Qwen Vision (qwen3.5-plus) |
| AI — 재랭킹 | GPT-4o-mini |
| 인증 | Passport.js (Local Strategy) |
| 인프라 | Docker, docker-compose, ngrok |
| 유효성 검사 | Zod |

---

## 코딩 스타일 & 네이밍 규칙

### 기본 규칙
- TypeScript strict 모드
- 들여쓰기: **2 spaces**
- 최대 줄 길이: **100자**
- **Line ending: LF(`\n`)** — CRLF(`\r\n`) 사용 금지
- 파일 끝에 빈 줄 필수

### 네이밍 규칙
| 대상 | 규칙 | 예시 |
|---|---|---|
| 파일 | kebab-case | `item-detail.tsx`, `routes.ts` |
| React 컴포넌트 | PascalCase | `ItemCard`, `SearchPage` |
| 함수/변수 | camelCase | `createEmbedding`, `queryText` |
| 상수 | UPPER_SNAKE_CASE | `FINAL_RESULT_COUNT` |
| API 경로 | kebab-case | `/api/search-similar` |

### Import 규칙
- 와일드카드(`*`) import 금지
- 사용하지 않는 import 금지

---

## 아키텍처 개요

- 기본 흐름: **Client (React) → API (Express routes.ts) → Storage (storage.ts) → PostgreSQL**
- `shared/schema.ts`: Drizzle 테이블 정의 + Zod 유효성 스키마 공유
- `shared/routes.ts`: API 경로 + 요청/응답 타입 클라이언트-서버 공유
- AI 로직 전체는 `server/routes.ts`에 집중 (embedding, vision, reranking)
- 인증: Passport.js 세션 기반, `server/auth.ts`에 설정

---

## AI 검색 파이프라인 상세

```
사용자 입력 (텍스트 / 이미지 / 둘 다)
        ↓
[입력 유효성 검사] — validateSearchPrompt()
  - 2자 미만, 자음/모음만, 영문 난타 등 필터링
        ↓
[이미지가 있으면] → Qwen Vision → createImageSearchText()
  → JSON 형태로 itemCategory, color, size, tags, description 추출
        ↓
[텍스트 + 이미지 요약 합산] → queryText 구성
        ↓
[OpenAI Embeddings] → createEmbedding() → 1536차원 벡터
        ↓
[pgvector 코사인 유사도 검색] → searchFoundItemsByEmbedding()
  → 상위 VECTOR_CANDIDATE_COUNT(기본 20)개 후보 (score > 0.15 필터)
        ↓
[LLM 재랭킹] → rerankCandidates()
  - 텍스트 전용: GPT-4o-mini
  - 이미지 포함: Qwen Vision
  → 각 후보에 0~1 점수 + 한국어 reasoning 생성
        ↓
[블렌드 점수] = 벡터 점수 × 0.35 + LLM 점수 × 0.65
        ↓
[최종 FINAL_RESULT_COUNT(기본 12)개 반환]
  + buildReasoningFromEvidence()로 사용자 친화적 설명 생성
```

---

## API 설계 규약

- API 경로 및 요청/응답 타입은 `shared/routes.ts`에 먼저 정의한다.
- 요청 유효성 검사는 Zod 스키마를 사용한다 (`api.xxx.input.parse(req.body)`).
- 인증이 필요한 엔드포인트는 `req.user` 체크 후 처리한다.
- 에러 응답 포맷: `{ message: string, field?: string }`
- 성공 응답: 직접 데이터 반환 (wrapper 없음)

---

## 환경 변수

| 변수명 | 설명 | 필수 |
|---|---|---|
| DATABASE_URL | PostgreSQL 연결 URL | ✅ |
| AI_INTEGRATIONS_OPENAI_API_KEY | OpenAI API 키 | ✅ |
| AI_INTEGRATIONS_OPENAI_BASE_URL | OpenAI Base URL | ❌ |
| QWEN_API_KEY | Qwen API 키 (이미지 분석용) | ✅ (이미지 기능) |
| QWEN_BASE_URL | Qwen Base URL | ❌ |
| OPENAI_TEXT_MODEL | 텍스트 모델 (기본: gpt-4o-mini) | ❌ |
| QWEN_VISION_MODEL | 비전 모델 (기본: qwen3.5-plus) | ❌ |
| OPENAI_EMBEDDING_MODEL | 임베딩 모델 (기본: text-embedding-3-small) | ❌ |
| VECTOR_CANDIDATE_COUNT | 벡터 검색 후보 수 (기본: 20) | ❌ |
| FINAL_RESULT_COUNT | 최종 결과 수 (기본: 12) | ❌ |

---

## 커밋 관련
- 커밋 메시지는 "feat: 메시지 내용" 과 같은 형식으로 작성할 것(ex. refactor: 폴링 방식 수정, fix: 무슨 서비스 버그 수정)
- 커밋은 최대한 작은 단위로 여러개 커밋할 것

---

## Notion 문서 자동화

### Notion 페이지 구조
```
공학설계 아이디어  (2696f823-4980-80a8-92d3-e04b65bece44)
├── 개발 내용  (3206f823-4980-81f5-9094-dc5f9a55fe05)
│   └── [YYYY-MM-DD | 작업 내용] 형식의 하위 페이지들
└── 프로젝트 설명  (3206f823-4980-81b6-a54d-c07b9910bf24)
    └── 프로젝트 전체 개요 및 기능 설명 (이 페이지 자체가 메인)
```

### 트리거 조건
사용자가 아래 문구를 말하면 GitHub MCP로 커밋/PR 정보를 조회한 뒤 Notion 페이지를 자동 생성한다:
- `"커밋했어"` / `"개발 내용 기록해줘"` → 최근 커밋 기반으로 개발 내용 하위 페이지 생성
- `"PR 머지됐어"` → PR 정보 기반으로 개발 내용 하위 페이지 생성
- `"프로젝트 설명 업데이트해줘"` → 현재 코드 상태 기반으로 프로젝트 설명 페이지 내용 갱신

### 개발 내용 페이지 형식
페이지 제목: `YYYY-MM-DD | {작업 내용 한 줄 요약}`

```markdown
## 📋 작업 개요
- **날짜**: 작업 날짜
- **커밋/PR**: #{번호 또는 해시} — {URL}
- **작업 유형**: 기능 추가 / 버그 수정 / 리팩토링 / AI 파이프라인 개선 / 인프라

## 🎯 작업 배경
왜 이 작업을 했는지

## 🔧 변경 내용
### 변경된 주요 파일
- `경로/파일명.ts` — 변경 요약

### 핵심 변화
주요 로직 변경 내용

## 📝 커밋 메시지
관련 커밋 목록
```

### 프로젝트 설명 페이지 갱신 규칙
- 새로운 기능이 추가될 때마다 관련 섹션을 업데이트한다.
- AI 파이프라인 변경 시 파이프라인 다이어그램을 갱신한다.
- DB 스키마 변경 시 스키마 섹션을 갱신한다.
- 페이지 전체를 교체하지 않고 변경된 섹션만 업데이트한다.

### 자동화 동작 규칙
- 변경된 파일 경로(`server/`, `client/src/pages/` 등)를 기반으로 작업 영역을 자동 추출한다.
- 커밋 메시지나 PR 본문이 비어 있으면 변경 파일 목록으로 내용을 구성한다.
- 페이지 생성 후 반드시 생성된 URL을 사용자에게 전달한다.

---

## AI 행동 지침

### 1. 코드 품질
- 네이밍 규칙 및 포맷팅 규칙을 항상 준수한다.
- **모든 파일 작성 시 Line ending은 LF(`\n`)를 사용한다.** CRLF(`\r\n`)는 사용하지 않는다.
- 포맷터 실행, import 정리만을 위한 변경은 별도 요청이 없는 한 수행하지 않는다.

### 2. 변경 범위 통제
- 요청된 작업 범위에 포함된 파일만 수정한다.
- 범위 외 변경이 필요하다고 판단되면 먼저 제안하고 승인을 받는다.
- 기존 코드 삭제는 명시적 요청 없이는 수행하지 않는다.

### 3. 설계 일관성
- API 추가 시 `shared/routes.ts`에 타입을 먼저 정의하고, `server/routes.ts`에 구현한다.
- AI 관련 로직은 `server/routes.ts` 내 함수로 분리하여 재사용성을 높인다.
- DB 스키마 변경 시 `shared/schema.ts`를 수정하고 `npm run db:push`를 안내한다.

### 4. 환경 / 보안
- API Key, Secret 등 민감 정보는 코드에 직접 포함하지 않는다.
- 환경별로 달라질 수 있는 설정은 환경 변수로 처리한다.

### 5. 작업 방식
- 모든 사고(thinking)는 영어로 하되, 사용자에게 제공하는 응답은 한글로 작성한다.
- 여러 변경이 필요하면 논리적 단위로 나누어 순차 수행한다.

### 6. 종료 조건
작업 종료 시 다음을 반드시 요약 및 제시한다:
- 작업에 대한 커밋 메시지 (제안)
- 남은 작업 또는 후속 작업
- 의도적으로 수행하지 않은 사항

### 7. 고위험 작업 정의
아래 항목은 반드시 사전 승인 없이는 수행하지 않는다:
- 인증 / 인가 로직 변경
- DB 스키마 변경 (`shared/schema.ts`)
- 외부 AI API 모델 변경 (비용 영향)
- AI 파이프라인 블렌드 비율 변경 (검색 품질 영향)

### 8. 자동 수행 금지 항목
다음 작업은 에이전트가 직접 수행하지 않고 반드시 제안만 한다:
- DB 마이그레이션 실행 (`npm run db:push`)
- docker-compose 재시작
- 데이터 삭제

### 9. MCP 서버 사용
- MCP 서버 리소스는 필요한 범위에서만 조회한다.
- MCP를 통한 외부 시스템 변경(쓰기/삭제/갱신)은 사전 승인 없이는 수행하지 않는다.
- 민감정보가 포함될 수 있는 리소스는 본문에 직접 노출하지 않는다.

---

## 테스트 & 검증

현재 별도 테스트 프레임워크 미적용. 기능 변경 시 최소 하나 이상의 검증 방법을 제공해야 한다:
- Postman / curl 요청 예시 제공
- 수동 검증 시나리오 서술 (어떤 입력으로 어떤 결과가 나와야 하는지)
- AI 검색 품질 변경 시 예시 쿼리와 기대 결과 명시
