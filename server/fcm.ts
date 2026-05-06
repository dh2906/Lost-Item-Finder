import { JWT } from "google-auth-library";

const firebaseMessagingScope = "https://www.googleapis.com/auth/firebase.messaging";

interface FirebaseServiceAccount {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

let firebaseAuthClient: JWT | null = null;
let firebaseProjectId: string | null = null;

function getFirebaseAuth(): { client: JWT; projectId: string } {
  if (firebaseAuthClient && firebaseProjectId) {
    return { client: firebaseAuthClient, projectId: firebaseProjectId };
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다."
    );
  }

  const serviceAccount = JSON.parse(serviceAccountJson) as FirebaseServiceAccount;
  if (
    !serviceAccount.client_email ||
    !serviceAccount.private_key ||
    !serviceAccount.project_id
  ) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON에 client_email, private_key, project_id가 필요합니다."
    );
  }

  firebaseAuthClient = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: [firebaseMessagingScope],
  });
  firebaseProjectId = serviceAccount.project_id;

  return { client: firebaseAuthClient, projectId: firebaseProjectId };
}

async function getFirebaseAccessToken(client: JWT): Promise<string> {
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error("Firebase access token을 발급받지 못했습니다.");
  }
  return tokenResponse.token;
}

export async function sendFcmNotification(params: {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ sent: boolean; error?: unknown }> {
  const { fcmToken, title, body, data } = params;

  try {
    const { client, projectId } = getFirebaseAuth();
    const accessToken = await getFirebaseAccessToken(client);
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            ...(data ? { data } : {}),
            webpush: {
              notification: {
                title,
                body,
                icon: "/icons/icon-192.png",
                badge: "/icons/icon-192.png",
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      throw new Error(`FCM HTTP ${response.status}: ${responseBody}`);
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err };
  }
}
