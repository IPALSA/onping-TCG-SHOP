// 값을 채우지 않으면 사이트는 로컬(체험) 모드로 동작합니다.

// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  appId: "YOUR_APP_ID"
};

// 치지직 개발자센터(Application)에서 등록한 값
window.CHZZK = {
  clientId: "YOUR_CHZZK_CLIENT_ID",
  // 치지직 앱의 '로그인 리디렉션 URL'과 글자 하나까지 똑같아야 합니다 (사이트 주소)
  redirectUri: "https://YOUR_ID.github.io/YOUR_REPO/",
  // 배포한 Cloud Function 주소
  loginFn: "https://asia-northeast3-YOUR_PROJECT.cloudfunctions.net/chzzkLogin"
};
