// 값을 채우지 않으면 사이트는 로컬(체험) 모드로 동작합니다.

// Firebase 콘솔 > 프로젝트 설정 > 내 앱(웹)에서 복사
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCVfcjyStcyOSmYnIFy25lTU8IbLl2jSnk",
  authDomain: "onping-tcg-shop.firebaseapp.com",
  projectId: "onping-tcg-shop",
  appId: "1:555209942698:web:ce07b002705b94c02c12d3"
};

// 치지직 개발자센터(Application)에서 등록한 값
window.CHZZK = {
  clientId: "a03b6006-20df-40e6-81b4-99bfff0d8622",
  // 치지직 앱의 '로그인 리디렉션 URL'과 글자 하나까지 똑같아야 합니다 (사이트 주소)
  redirectUri: "https://ipalsa.github.io/onping-TCG-SHOP/",
  // 배포한 Cloud Function 주소
  loginFn: "https://asia-northeast3-YOUR_PROJECT.cloudfunctions.net/chzzkLogin"
};
