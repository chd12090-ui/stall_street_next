# 변기투자 · STALL STREET (Next.js)

뉴스를 읽고 가상의 종목을 거래하는 픽셀 주식 게임입니다. 원래 esbuild + Cloudflare Worker로 돌던 프로젝트를 Next.js(App Router)로 옮겼습니다. 게임 내용과 화면은 그대로이고, npm 패키지를 설치해 바로 가져다 쓸 수 있는 구조가 됐습니다. 게임별 설명은 `HANDOFF.md`에 있습니다.

## 실행

Node.js 22.15 이상이 필요합니다(24 권장).

```sh
npm install      # 설치하면서 sql.js 파일을 public/vendor/sql.js로 복사합니다
npm run dev      # http://localhost:3000
```

```sh
npm run build    # 배포용 빌드
npm start        # 빌드 결과 실행
npm test         # 테스트 (node --test)
```

휴대폰으로 같은 와이파이에서 `http://192.168.x.x:3000`처럼 접속하면 게임이 시작되지 않습니다. 게스트 ID를 만드는 `crypto.randomUUID`·`crypto.subtle`이 보안 연결(https 또는 localhost)에서만 동작하기 때문입니다(원본도 같음). 휴대폰에서 테스트할 때는 `npx next dev --experimental-https`로 띄우고, 터미널에 `allowedDevOrigins` 경고가 나오면 `next.config.mjs`에 그 주소를 추가하세요.

## 폴더 구조

```
src/
  app/                    Next.js 라우트
    layout.jsx            <html>·메타 정보·CSS 불러오는 순서(원래 index.html)
    page.jsx              게임 페이지 (/)
    api/[...path]/route.js  나중에 서버 DB를 붙일 때 쓰는 API 라우트
  components/
    GameRoot.jsx          게임을 띄우는 클라이언트 컴포넌트
    game-frame-markup.mjs 게임이 그려지는 기본 틀(로딩 화면 포함)
  ui/                     React 화면 (원래 src/*.jsx)
  game/                   게임 규칙·상태 모듈 (원래 dist/*.mjs)
  styles/                 CSS (원래 dist/*.css)
  server/                 게임 API 로직 (원래 worker/*.mjs)
    db/                   DB 어댑터·마이그레이션 실행기
  storage/                브라우저 저장소 (지금 쓰는 "서버")
db/migrations/            SQL 스키마 (원래 drizzle/)
public/                   그림·폰트·소리 (경로 그대로: /art/..., /audio/...)
scripts/                  그림 제작용 Python, 시세 기록 생성, sql.js 복사 등
test/                     테스트 (node --test)
```

## 데이터 저장 방식 (지금)

데이터는 두 종류이고, 둘 다 브라우저에 저장됩니다.

| 데이터 | 저장 위치 | 비고 |
|---|---|---|
| 플레이 저장(자산, 거래, 설정 등) | `localStorage` | 원본과 동일 |
| 방·친구 채팅·선거·살굿·협박·염탐 기록 | `IndexedDB`의 SQLite 파일 | 원래 서버 DB에 있던 것 |

원래 서버(Worker)에서 돌던 게임 API 코드를 **브라우저 안에서 그대로 실행**합니다. `room-session.mjs`가 보내던 `/api/...` 요청을 `src/storage/game-api-client.mjs`가 가로채서 같은 API 코드로 처리하고, SQL은 sql.js(웹어셈블리 SQLite)가 실행합니다. 바뀐 내용이 있으면 SQLite 파일 전체를 IndexedDB에 다시 저장합니다.

```
게임(room-session) ─ /api/... ─▶ game-api-client
                                   ├─ local  ─▶ src/server API 코드 ─▶ sql.js ─▶ IndexedDB   (지금)
                                   └─ remote ─▶ fetch ─▶ src/app/api 라우트 ─▶ 서버 DB      (나중에)
```

- 탭을 여러 개 열어도 요청을 하나씩 처리하고, 다른 탭이 저장한 최신 파일을 먼저 읽습니다.
- 브라우저 개발자 도구 콘솔에서 다음을 쓸 수 있습니다.
  - `await stallStreetLocalDb.info()` 저장 위치와 크기
  - `await stallStreetLocalDb.download()` SQLite 파일 내려받기 (DB Browser for SQLite 같은 도구로 열림)
  - `await stallStreetLocalDb.reset()` 이 브라우저의 방·채팅·투표 기록 삭제

**한계:** 다른 기기나 다른 브라우저와는 데이터가 공유되지 않습니다. "혼자 봇과 플레이하기"는 전부 동작하지만, "방 만들기"·"참가하기"는 같은 브라우저 안에서만 의미가 있어 실제 친구와 함께하려면 서버 DB가 필요합니다. 브라우저 사이트 데이터를 지우면 기록도 사라집니다.

## 나중에 DB 붙이기

API 코드는 SQLite 문법 SQL과 Cloudflare D1 방식(`prepare().bind().first()/all()/run()`, `batch()`)으로 작성돼 있습니다. 그래서 SQLite 계열 DB가 가장 쉽습니다.

| 선택지 | 작업량 |
|---|---|
| Cloudflare D1 | 원래 쓰던 DB. API 코드는 그대로 쓰고, Next.js를 Cloudflare에 배포하는 설정만 따로 필요 |
| Turso(libSQL), 서버의 SQLite 파일 | 드라이버를 `query`·`exec` 두 함수로 감싼 뒤 `createD1()`에 넘기면 됨 |
| PostgreSQL·MySQL | `INSERT OR IGNORE`, `rowid`, 스칼라 `MAX(a,b)` 등 일부 SQL 수정 필요 |

순서:

1. `src/server/db/server-db.mjs`의 `getServerDb()`가 D1 호환 객체를 돌려주게 작성합니다. 다른 SQLite 드라이버는 `src/server/db/d1-adapter.mjs`의 `createD1(engine)`으로 감싸면 되고, `src/server/db/node-sqlite.mjs`가 완성된 예시입니다.
2. `db/migrations/*.sql`을 DB에 적용합니다(`src/server/db/migrate.mjs`의 `migrate(engine)` 사용 가능).
3. `.env.local`에 `NEXT_PUBLIC_GAME_API_MODE=remote`를 넣고 다시 빌드합니다. 이제 요청이 `src/app/api/[...path]/route.js`로 갑니다.

Vercel 같은 서버리스 환경에서는 서버에 SQLite 파일을 둘 수 없으니 D1·Turso처럼 호스팅되는 DB를 쓰세요. 지금 브라우저에 쌓인 기록을 옮기고 싶다면 `stallStreetLocalDb.download()`로 받은 파일이 같은 스키마의 SQLite 파일입니다.

## 라이브러리 추가

```sh
npm install 패키지이름
```

React 화면(`src/ui/*.jsx`)이나 게임 모듈(`src/game/*.mjs`)에서 `import`하면 됩니다. 게임 코드는 `GameRoot`가 브라우저에서만 불러오므로 `window`·`document`를 그대로 써도 됩니다. `.mjs` 파일에서 상대 경로로 불러올 때는 `'./market.mjs'`처럼 확장자까지 적어야 합니다.

## 원본에서 바뀐 점

- esbuild 빌드 + import map + Cloudflare Worker 정적 서버 → Next.js 16 (App Router)
- React 18 → 19 (Next.js 16 요구사항). `fetchpriority` 속성을 React 19 표기 `fetchPriority`로 수정
- `index.html` → `src/app/layout.jsx`(메타·CSS 순서)와 `src/components/game-frame-markup.mjs`(기본 틀)
- 그림·소리 경로 `./art/...` → `/art/...` (CSS의 `url()` 포함, Next.js 규칙)
- CSS 안의 `@import` 2개(`icons.css`, `rehabilitation-art.css`)는 layout에서 같은 순서로 직접 불러옴
- 서버 API 요청은 `src/storage`의 브라우저 저장소가 처리 (위 설명)
- 삭제: `scripts/build-react.mjs`, `scripts/build-worker.mjs`, `scripts/preview-election.mjs`, `worker/index.mjs`, `.openai/hosting.json`, `dist/`의 빌드 결과물(`entry.mjs`, `react-ui.mjs`, `react-core-*.mjs`)
- 그림 제작 스크립트(`scripts/*.py`)와 `prepare-chart-history.mjs`의 출력 경로를 `src/game/`으로 수정

## 알아둘 점

- `public/vendor/sql.js`는 `npm install` 때 생성되므로 git에 올리지 않습니다(`.gitignore`). 배포 환경에서도 install 단계에서 만들어집니다.
- `db/migrations`를 고치면 `npm run dev`·`build`·`test` 전에 `src/server/db/migrations.generated.mjs`가 자동으로 다시 만들어집니다.
- `scripts/prepare-chart-history.mjs`를 다시 실행하면 원본 ZIP에 없던 펀드 시세 파일 10개가 추가로 생깁니다. 원본에서 실행해도 똑같으니 이전 변경이 반영되지 않았던 것으로 보입니다.
