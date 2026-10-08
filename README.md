# 타일 정원

친구 2~4명이 **링크 하나로, 가입 없이** 함께 하는 타일 놓기 웹게임입니다(아줄 기본 규칙).

- 프론트엔드: Vite + React + TypeScript (CSS Modules)
- 실시간 동기화: Firebase Firestore + 익명 인증
- 배포: Vercel (무료)

앱 이름은 [`src/config.ts`](src/config.ts)의 `APP_NAME` 한 곳에서 바꿀 수 있습니다.

---

## 내 컴퓨터에서 실행하기

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 규칙 엔진 테스트(1,000판 시뮬레이션 포함)
```

Firebase 설정(.env)이 없으면 **"한 기기에서 하기"(핫시트)**만 동작합니다. 온라인 기능은 아래 1~3단계를 마친 뒤 사용할 수 있습니다.

---

## 배포 가이드 (처음 하는 분 기준)

### 1단계. Firebase 프로젝트 만들기

1. <https://console.firebase.google.com> 접속 → 구글 계정으로 로그인
2. **[프로젝트 추가]**(또는 "Firebase 프로젝트 만들기") 클릭
3. 프로젝트 이름 입력(예: `tile-garden`) → [계속]
4. "Google 애널리틱스" 화면: **사용 안 함**으로 꺼도 됩니다 → [프로젝트 만들기]
5. 완료되면 [계속]을 눌러 프로젝트 화면으로 들어갑니다.

### 2단계. Firestore 데이터베이스 만들기

1. 왼쪽 메뉴 **[빌드] → [Firestore Database]**
2. **[데이터베이스 만들기]**
3. 위치(Location): **`asia-northeast3 (Seoul)`** 선택 ※ 나중에 못 바꿉니다
4. 보안 규칙 시작 모드: **[프로덕션 모드]** → [만들기]
5. 만들어지면 위쪽 **[규칙]** 탭을 누르고, 이 저장소의 [`firestore.rules`](firestore.rules) 내용을 **전부 복사해 붙여넣고 [게시]**

   (명령줄을 쓰고 싶다면 대신 `npx firebase-tools login` → `npx firebase-tools deploy --only firestore:rules --project <프로젝트ID>`)

### 3단계. 익명 로그인 켜기

1. 왼쪽 메뉴 **[빌드] → [Authentication]** → [시작하기]
2. **[로그인 방법]** 탭 → **[익명]** 선택 → **사용 설정** 켜기 → [저장]

### 4단계. 웹 앱 등록하고 설정값 복사

1. 왼쪽 위 **톱니바퀴 → [프로젝트 설정]**
2. 아래 "내 앱"에서 **웹 아이콘 `</>`** 클릭
3. 앱 닉네임 입력(예: `web`) → "Firebase 호스팅"은 체크하지 않음 → [앱 등록]
4. 화면에 나오는 `firebaseConfig = { apiKey: ..., authDomain: ..., ... }` 값을 확인합니다.
5. 프로젝트 폴더에 `.env.example`을 복사해 `.env` 파일을 만들고 값을 채웁니다.

   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=tile-garden.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=tile-garden
   VITE_FIREBASE_STORAGE_BUCKET=tile-garden.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
   ```

   > 이 값들은 브라우저에 공개되는 값이라 비밀번호는 아니지만, `.env`는 저장소에 올리지 않습니다(`.gitignore`에 포함).

6. `npm run dev`로 다시 실행하면 첫 화면에 [방 만들기]가 나타납니다.

### 5단계. GitHub에 올리기

1. <https://github.com/new> 에서 새 저장소 만들기(예: `tile-garden`, Private도 가능, README 추가 체크 해제)
2. 만들어진 화면의 안내대로 이 폴더에서:

   ```bash
   git remote add origin https://github.com/<내아이디>/tile-garden.git
   git push -u origin main
   ```

### 6단계. Vercel로 배포

1. <https://vercel.com> → **[Sign Up] → [Continue with GitHub]**
2. 대시보드에서 **[Add New…] → [Project]** → 방금 만든 저장소 옆 **[Import]**
3. Framework Preset이 **Vite**로 잡혔는지 확인
4. **[Environment Variables]**를 펼쳐 `.env`의 6개 값을 이름·값 그대로 하나씩 추가
5. **[Deploy]** → 1~2분 뒤 `https://tile-garden-xxxx.vercel.app` 같은 주소가 생깁니다.

이후에는 GitHub에 push할 때마다 자동으로 다시 배포됩니다. `/r/ABCD` 같은 주소를 새로고침해도 동작하도록 [`vercel.json`](vercel.json)에 rewrite 설정이 들어 있습니다.

### 7단계. Firebase에 Vercel 주소 허용

1. Firebase 콘솔 **[Authentication] → [설정] 탭 → [승인된 도메인]**
2. **[도메인 추가]** → `tile-garden-xxxx.vercel.app` (https:// 없이) → [추가]

### 8단계. 친구들과 플레이

1. 배포 주소로 접속 → 닉네임 입력 → **[방 만들기]**
2. 대기실의 **[초대 링크 복사]**로 링크를 카톡 등으로 보내기
3. 2~4명이 모이면 방장이 **[게임 시작]**

---

## (선택) 오래된 방 자동 삭제

방 문서에는 `expireAt`(마지막 활동 + 24시간) 필드가 있습니다. 24시간이 지난 방은 앱에서 "만료된 방"으로 안내합니다.
문서를 실제로 지우려면 Firebase 콘솔 **[Firestore] → [TTL 정책]**(또는 Google Cloud 콘솔의 Firestore TTL)에서
컬렉션 그룹 `rooms`, 필드 `expireAt`으로 정책을 만들면 됩니다. 만들지 않아도 게임에는 지장이 없습니다.

---

## 구조

```
src/
  config.ts            앱 이름, 방 만료 시간
  game/                규칙 엔진(UI·서버와 분리된 순수 함수)
    engine.ts          createGame / legalMoves / isLegal / applyMove / scorePlacement / finalBonus
    rules/standard.ts  기본 규칙 세트(벽 배치, 바닥 감점, 공장 수) — 변형 규칙은 rules/에 추가
    engine.test.ts     Vitest 테스트
  online/              Firebase 연동(익명 로그인, 방 트랜잭션)
  ui/                  화면 컴포넌트
  pages/               첫 화면 / 핫시트 / 온라인 방
firestore.rules        보안 규칙
```

### 온라인 동작 방식

- 방 문서 `rooms/{코드}`를 모든 참가자가 실시간 구독합니다.
- 수를 둘 때 Firestore **트랜잭션**으로 최신 상태를 읽고 → 내 차례·합법 수인지 확인 → `applyMove` → `version + 1`로 저장합니다.
- Firestore는 배열 안의 배열을 저장할 수 없어 게임 상태는 `stateJson`(문자열)로 저장하고, 보안 규칙이 검사할 수 있도록 지금 차례인 사람의 uid를 `turnUid`에 따로 둡니다.
- 익명 로그인 uid가 브라우저에 남아 있어 같은 기기로 링크를 다시 열면 자기 자리로 돌아옵니다.
