require("dotenv").config();
const express = require("express");
const { Resend } = require("resend");

const pool = require("./db");
const {
  createAuthToken,
  verifyAuthToken
} = require("./auth");
const validateApiKey =
  require("./middleware/apiKey");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const resend = new Resend(
  process.env.RESEND_API_KEY
);
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      success: true,
      message: "Enterprise Bot backend is running",
      database: "PostgreSQL connected",
      time: result.rows[0].current_time
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });

  }
});
// ==============================
// JWT HELPER
// ==============================

function getAuthenticatedUser(token) {

  try {

    const decoded =
      verifyAuthToken(token);

    return decoded;

  } catch (error) {

    return null;

  }

}
function generateTicketNumber() {

  const timestamp =
    Date.now().toString().slice(-8);

  const random =
    Math.floor(1000 + Math.random() * 9000);

  return `CARD-${timestamp}-${random}`;
}
app.post(
  "/tools/authenticate-customer/{accountNumber}/{pin}",
  validateApiKey,
  async (req, res) => {

    try {

      const {
        accountNumber,
        pin
      } =  req.params;
console.log("Authentication request:", {
        accountNumber,
        pinProvided: !!pin
      });
      // 1. Validate input
      if (!accountNumber || !pin) {

        return res.status(400).json({
          success: false,
          code: "MISSING_CREDENTIALS",
          message:
            "Account number and PIN are required."
        });

      }

      // 2. Find account
      const result = await pool.query(
        `
        SELECT *
        FROM accounts
        WHERE account_number = $1
        `,
        [accountNumber]
      );

      const account = result.rows[0];

      // 3. Verify credentials
      if (
        !account ||
        account.pin !== String(pin)
      ) {

        return res.status(401).json({
          success: false,
          code: "AUTHENTICATION_FAILED",
          message:
            "The credentials could not be verified."
        });

      }

      // 4. Generate JWT
      const authToken =
        createAuthToken(account);

      // 5. Return authentication result
      return res.json({

        success: true,

        authenticated: true,

        authToken,

        customer: {
          id: account.id,
          accountNumber:
            account.account_number,
          name: account.name
        },

        expiresInSeconds: 600

      });

    } catch (error) {

      console.error(
        "Authentication error:",
        error
      );

      return res.status(500).json({

        success: false,

        code:
          "AUTHENTICATION_SERVICE_ERROR",

        message:
          "Authentication service is currently unavailable."

      });

    }

  }
);
app.post(
   "/tools/get-account-balance",
  validateApiKey,
  async (req, res) => {

    try {

      const {
        authToken
      } = req.query;

      // 1. Check token exists
      if (!authToken) {

        return res.status(401).json({

          success: false,

          code:
            "AUTHENTICATION_REQUIRED",

          message:
            "Authentication is required before retrieving balance."

        });

      }

      // 2. Verify JWT
      const user =
        getAuthenticatedUser(authToken);

      if (!user) {

        return res.status(401).json({

          success: false,

          code:
            "INVALID_AUTH_TOKEN",

          message:
            "Authentication token is invalid or expired."

        });

      }

      // 3. Get account from PostgreSQL
      const result =
        await pool.query(
          `
          SELECT
              id,
              account_number,
              name,
              balance
          FROM accounts
          WHERE id = $1
          `,
          [user.userId]
        );

      const account =
        result.rows[0];

      // 4. Account doesn't exist
      if (!account) {

        return res.status(404).json({

          success: false,

          code:
            "ACCOUNT_NOT_FOUND",

          message:
            "Account could not be found."

        });

      }

      // 5. Return balance
      return res.json({

        success: true,

        accountNumber:
          account.account_number,

        customerName:
          account.name,

        balance:
          Number(account.balance),

        currency: "USD"

      });

    } catch (error) {

      console.error(
        "Balance lookup error:",
        error
      );

      return res.status(500).json({

        success: false,

        code:
          "BALANCE_SERVICE_ERROR",

        message:
          "Unable to retrieve account balance."

      });

    }

  }
);
// ==============================
// TOOL 3
// BLOCK CARD
// ==============================

app.post(
   "/tools/block-card",
  validateApiKey,
  async (req, res) => {

    try {

      const {
        authToken,
        cardLast4,
        reason
      } = req.query;

      // 1. Check authentication token
      if (!authToken) {

        return res.status(401).json({

          success: false,

          code:
            "AUTHENTICATION_REQUIRED",

          message:
            "Authentication is required before blocking a card."

        });

      }

      // 2. Verify JWT
      const user =
        getAuthenticatedUser(authToken);

      if (!user) {

        return res.status(401).json({

          success: false,

          code:
            "INVALID_AUTH_TOKEN",

          message:
            "Authentication token is invalid or expired."

        });

      }

      // 3. Validate card details
      if (!cardLast4) {

        return res.status(400).json({

          success: false,

          code:
            "CARD_DETAILS_REQUIRED",

          message:
            "Please provide the last four digits of the card."

        });

      }

      if (!/^\d{4}$/.test(String(cardLast4))) {

        return res.status(400).json({

          success: false,

          code:
            "INVALID_CARD_NUMBER",

          message:
            "Card last four digits must contain exactly four digits."

        });

      }

      // 4. Find the authenticated user's card
      const result =
        await pool.query(
          `
          SELECT
              id,
              account_number,
              name,
              email,
              card_last4,
              card_status
          FROM accounts
          WHERE id = $1
          `,
          [user.userId]
        );

      const account =
        result.rows[0];

      if (!account) {

        return res.status(404).json({

          success: false,

          code:
            "ACCOUNT_NOT_FOUND",

          message:
            "Authenticated account could not be found."

        });

      }

      // 5. Verify card belongs to user
      if (
        account.card_last4 !== String(cardLast4)
      ) {

        return res.status(400).json({

          success: false,

          code:
            "CARD_NOT_FOUND",

          message:
            "The card could not be verified for this account."

        });

      }

      // 6. Check if already blocked
      if (
        account.card_status === "BLOCKED"
      ) {

        return res.status(409).json({

          success: false,

          code:
            "CARD_ALREADY_BLOCKED",

          message:
            "This card has already been blocked.",

          ticketNumber:
            null

        });

      }

      // 7. Generate ticket
      const ticketNumber =
        generateTicketNumber();

      // 8. Update database
      await pool.query(
        `
        UPDATE accounts
        SET
            card_status = 'BLOCKED',
            blocked_at = NOW(),
            ticket_number = $1
        WHERE id = $2
        `,
        [
          ticketNumber,
          user.userId
        ]
      );

      // 9. Return result
      return res.json({

        success: true,

        cardBlocked: true,

        ticketNumber,

        customerName:
          account.name,

        accountNumber:
          account.account_number,

        cardLast4:
          account.card_last4,

        reason:
          reason || "Card reported lost or compromised",

        message:
          "Your card has been successfully blocked."

      });

    } catch (error) {

      console.error(
        "Card block error:",
        error
      );

      return res.status(500).json({

        success: false,

        code:
          "CARD_BLOCK_SERVICE_ERROR",

        message:
          "Unable to block the card at this time."

      });

    }

  }
);
// ==============================
// TOOL 4
// SEND CARD BLOCK CONFIRMATION
// ==============================

app.post(
    "/tools/send-card-block-confirmation",
  validateApiKey,
  async (req, res) => {

    try {

      const {
        authToken,
        ticketNumber
      } = req.query;

      // 1. Check authentication
      if (!authToken) {

        return res.status(401).json({

          success: false,

          code:
            "AUTHENTICATION_REQUIRED",

          message:
            "Authentication is required."

        });

      }

      // 2. Verify JWT
      const user =
        getAuthenticatedUser(authToken);

      if (!user) {

        return res.status(401).json({

          success: false,

          code:
            "INVALID_AUTH_TOKEN",

          message:
            "Authentication token is invalid or expired."

        });

      }

      // 3. Validate ticket number
      if (!ticketNumber) {

        return res.status(400).json({

          success: false,

          code:
            "TICKET_NUMBER_REQUIRED",

          message:
            "Ticket number is required."

        });

      }

      // 4. Get authenticated account
      const result =
        await pool.query(
          `
          SELECT
              id,
              account_number,
              name,
              email,
              card_status,
              ticket_number
          FROM accounts
          WHERE id = $1
          `,
          [user.userId]
        );

      const account =
        result.rows[0];

      if (!account) {

        return res.status(404).json({

          success: false,

          code:
            "ACCOUNT_NOT_FOUND",

          message:
            "Authenticated account could not be found."

        });

      }

      // 5. Verify ticket belongs to user
      if (
        account.ticket_number !== ticketNumber
      ) {

        return res.status(400).json({

          success: false,

          code:
            "INVALID_TICKET",

          message:
            "The ticket could not be verified."

        });

      }

      // 6. Verify card was actually blocked
      if (
        account.card_status !== "BLOCKED"
      ) {

        return res.status(400).json({

          success: false,

          code:
            "CARD_NOT_BLOCKED",

          message:
            "Card has not been successfully blocked."

        });

      }

      // 7. Send confirmation email
      const {
        data,
        error
      } = await resend.emails.send({

        from:
          process.env.EMAIL_FROM,

        to: [
          account.email
        ],

        subject:
          "Card Block Confirmation",

        html: `
          <h2>Card Block Confirmation</h2>

          <p>Hello ${account.name},</p>

          <p>
            Your card has been successfully blocked.
          </p>

          <p>
            <strong>Account Number:</strong>
            ${account.account_number}
          </p>

          <p>
            <strong>Ticket Number:</strong>
            ${ticketNumber}
          </p>

          <p>
            <strong>Card Status:</strong>
            BLOCKED
          </p>

          <p>
            Please keep the ticket number
            for future reference.
          </p>

          <p>
            Thank you.
          </p>
        `

      });

      // 8. Handle email failure
      if (error) {

        console.error(
          "Resend error:",
          error
        );

        return res.status(502).json({

          success: false,

          code:
            "NOTIFICATION_FAILED",

          message:
            "Card was blocked successfully, but confirmation email could not be sent.",

          ticketNumber

        });

      }

      // 9. Success
      return res.json({

        success: true,

        notificationSent: true,

        notificationType: "EMAIL",

        ticketNumber,

        email:
          account.email,

        message:
          "Card block confirmation email sent successfully.",

        emailId:
          data?.id || null

      });

    } catch (error) {

      console.error(
        "Notification error:",
        error
      );

      return res.status(500).json({

        success: false,

        code:
          "NOTIFICATION_SERVICE_ERROR",

        message:
          "Unable to send confirmation email.",

        ticketNumber:
          req.query.ticketNumber || null

      });

    }

  }
);
app.listen(PORT, () => {
  console.log(
    `Server running at http://localhost:${PORT}`
  );
});