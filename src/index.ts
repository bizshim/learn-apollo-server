import express, { Request, Response, NextFunction } from "express";
import { postgraphile } from "postgraphile";
import jwt, { JwtPayload } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// JWT のデコード結果の型を定義
interface DecodedToken extends JwtPayload {
  sub: string;
  roles?: string[];
}

// JWKS クライアントの設定
const client = jwksClient({
  jwksUri: "https://login.microsoftonline.com/YOUR_TENANT_ID/discovery/v2.0/keys",
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("Signing key retrieval error:", err);
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

// 🔹 **修正: `void` を期待するように `return;` を追加**
const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return; // 🔥 追加: 関数の戻り値を `void` にする
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await new Promise<DecodedToken>((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        { audience: "api://your-api", issuer: "https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0" },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === "string") {
            return reject(new Error("Invalid token"));
          }
          resolve(decoded as DecodedToken);
        }
      );
    });

    console.log("Authenticated user:", decoded);
    (req as any).decodedUser = decoded; // 🔥 Request オブジェクトにデコード済みユーザー情報を保存

    return next(); // 認証成功 → 次のミドルウェアへ
  } catch (error) {
    console.error("JWT Verification Error:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return; // 🔥 追加: 関数の戻り値を `void` にする
  }
};

// 🔥 **認証ミドルウェアを適用**
app.use(authenticateToken);

app.use(
  postgraphile(process.env.DATABASE_URL, process.env.SCHEMA_NAME, {
    graphiql: true,
    enhanceGraphiql: true,
    watchPg: true,
    enableCors: true,
    pgSettings: async (req) => {
      const user = (req as any).decodedUser as DecodedToken;
      if (!user) return {};

      return {
        "jwt.claims.user_id": user.sub, // Azure AD のユーザーID
        "jwt.claims.roles": user.roles?.join(","), // ユーザーのロール
      };
    },
  })
);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}/graphiql`);
});