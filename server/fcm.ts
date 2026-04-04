import * as admin from "firebase-admin";

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다."
    );
  }

  const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  return firebaseApp;
}

export async function sendFcmNotification(params: {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  const { fcmToken, title, body, data } = params;

  try {
    const app = getFirebaseApp();
    await admin.messaging(app).send({
      token: fcmToken,
      notification: { title, body },
      ...(data ? { data } : {}),
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
        },
      },
    });
    console.log("[FCM] 푸시 알림 발송 성공");
  } catch (err) {
    // FCM 발송 실패는 로그만 남기고 메인 로직은 계속 진행
    console.error("[FCM] 푸시 알림 발송 실패:", err);
  }
}
