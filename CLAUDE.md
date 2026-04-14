# CLAUDE.md — Findy (Lost-Item-Finder)

> Claude가 이 저장소에서 작업할 때 따라야 할 지침과 자동화 워크플로우

---

## 프로젝트 개요

**Findy** — AI 기반 분실물 매칭 웹 서비스 (졸업설계)

| 항목 | 내용 |
|------|------|
| 팀 | 강성훈, 이관우, 이동훈 + 1명 |
| 지도교수 | 문일영 |
| 도메인 | `findy.r-e.kr` |
| 레포 | `dh2906/Lost-Item-Finder` |

### 기술 스택

- **Frontend**: React 18 + TypeScript + Vite, Tailwind CSS, PWA (injectManifest)
- **Backend**: Express.js, Drizzle ORM, Passport.js (session-based auth)
- **DB**: PostgreSQL + pgvector (Docker, port 5433)
- **AI Pipeline**: text-embedding-3-small (1536-dim), Qwen Vision API, GPT-4o-mini reranking
  - 매칭 가중치: keyword 26%, vector 24%, category 18%, date 18%, color 8%, location 6%
  - 벡터:LLM 블렌드 = 35:65, threshold 0.42, top 12
- **Notifications**: Firebase Cloud Messaging (FCM), PWA push
- **기타**: Kakao Maps API, Drizzle migrations

### 브랜치 전략

- `main`: 프로덕션
- `develop`: 통합 브랜치
- `feat/*`: 기능 브랜치 (PR → develop or main)

---

## 자동화 워크플로우: Commit → Push → Codex 코드 리뷰 루프

작업 완료 후 Claude는 아래 순서를 **결함이 없을 때까지** 자동으로 반복한다.

```
[구현 완료]
     │
     ▼
[1] git commit & push  (GitHub MCP: push_files 또는 create_or_update_file)
     │
     ▼
[2] Codex 에이전트에게 코드 리뷰 요청  (Codex MCP: codex)
     │
     ├─ 결함 없음 ──▶ ✅ 완료 (사용자에게 결과 보고)
     │
     └─ 결함 발견 ──▶ [3] Claude가 직접 수정
                              │
                              └──▶ [1] 로 돌아가 반복
```

### 상세 단계

#### [1] 커밋 & 푸시

- `github:push_files` 또는 `github:create_or_update_file` 사용
- 커밋 메시지 컨벤션: `type(scope): description`
  - type: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
- SHA 충돌 방지: `create_or_update_file` 전에 반드시 `get_file_contents`로 현재 SHA 조회

#### [2] Codex 코드 리뷰 요청

```
codex:codex 호출 파라미터:
  prompt: "아래 변경사항에 대해 코드 리뷰해줘. [변경 내용 요약]. 다음을 중점 검토해줘:
           1. 버그 및 런타임 오류
           2. 타입 안전성 (TypeScript)
           3. 보안 취약점
           4. 성능 이슈
           5. 코드 스타일 및 가독성
           결함이 발견되면 파일명, 라인, 구체적 수정 방법을 명시해줘.
           결함이 없으면 '✅ LGTM'으로 시작하는 응답을 줘."
  cwd: "C:\\Users\\janoo\\OneDrive\\바탕 화면\\File\\4학년 1학기\\졸업설계\\프로젝트\\Lost-Item-Finder"
  sandbox: "read-only"
  approval-policy: "never"
```

#### [3] 결함 수정

- Codex 응답에서 지적된 항목을 Claude가 직접 수정
- 수정 후 [1]로 복귀하여 루프 재실행
- **루프 종료 조건**: Codex 응답이 `✅ LGTM`으로 시작할 때

#### 루프 안전장치

- 최대 반복 횟수: **5회** (초과 시 사용자에게 상황 보고 후 중단)
- 동일한 결함이 2회 이상 반복될 경우: 사용자에게 에스컬레이션
- Codex MCP 호출 실패 시: 오류 내용 보고 후 중단

---

## 주요 파일 가이드

| 파일 | 설명 |
|------|------|
| `server/routes.ts` | 백엔드 전체 로직 (AI 파이프라인, 매칭, 보안) |
| `shared/schema.ts` | DB 스키마 (Drizzle ORM, pgvector) |
| `client/src/pages/` | 프론트엔드 페이지 목록 |
| `client/src/components/` | 공용 컴포넌트 |
| `server/fcm.ts` | FCM 푸시 알림 로직 |

---

## 환경 / 인프라

- **로컬 DB**: `docker exec -it lost-found-finder-db psql -U postgres -d lost_found_finder`
- **서버 DB**: `psql-findy` 별칭 (Ubuntu workstation)
- **Firebase 프로젝트**: `lost-item-finder-f59cd`
- **서비스 계정**: `/var/app/secrets/lost-item-finder-fcm.json`
- **배포**: `git pull && npm run build && npm run start`

---

## Claude 행동 원칙

1. **코드 확인 우선**: 기술적 사실은 반드시 실제 코드베이스를 확인 후 답변
2. **가중치/설계 출처 투명성**: 매칭 가중치 등 설계 결정은 "초기 휴리스틱 값, 추후 데이터 기반 최적화 예정"으로 명시
3. **커밋 원자성**: 관련 변경사항은 하나의 커밋으로 묶기
4. **Notion 동기화**: 주요 작업 완료 후 Notion 개발 로그 업데이트
5. **자율 실행**: 사용자의 최소 개입으로 브랜치 생성 → 구현 → 커밋 → PR → 리뷰 루프 완주
