# Enterprise Bank Voice Bot

## Overview

This project implements a secure voice banking assistant using the Enterprise Bot AIDA platform.

The voice bot allows customers to authenticate themselves using an account number and PIN, check their account balance, and report/block a lost or compromised card. The bot follows an agentic approach where the LLM decides when to request authentication, invoke backend tools, and respond to the customer.

## Architecture

```text
Customer
   |
   | Voice
   v
Enterprise Bot AIDA
   |
   | LLM Agent
   |
   +---- authenticate_customer
   |
   +---- get_account_balance
   |
   +---- block_customer_card and update_user_action_data
   |
   +---- send_confirmation_email
   |
   v
Node.js Backend APIs
   |
   v
PostgreSQL Database
```

## Key Features

* Voice input and voice output through Enterprise Bot AIDA
* Account number + PIN authentication
* Authentication required before accessing account information
* Account balance lookup
* Lost/stolen card blocking
* Ticket/reference number generation
* User action update
* Email confirmation after card blocking
* Error handling for authentication and backend failures
* PostgreSQL database with multiple test accounts
* Agentic tool calling through the AIDA LLM

## Tech Stack

* Enterprise Bot AIDA – Voice bot and LLM agent
* Node.js – Backend APIs
* Express.js – REST API framework
* PostgreSQL – Account database
* JWT – Authentication/session token
* Render – Backend deployment
* GitHub – Source code repository
* Email service – Out-of-band confirmation

## Agentic Tool Flow

The LLM is configured with backend tools instead of using a hardcoded conversational flow. AgentId: 6a8dd8ded8e0cb12a48626b8 (Enterprise Bank Voice Assistant)

### 1. Authentication

When a customer requests account information, the agent asks for the account number and PIN.

The agent invokes the authentication tool:

```text
abirami_authenticate_customer
```

The backend validates the credentials against PostgreSQL.

On successful authentication, the API returns an authentication token and customer information.

### 2. Balance Lookup

After successful authentication, the agent invokes:

```text
abirami_get_account_balance
```

The authenticated customer information/token is used to retrieve the customer's balance.

The agent then communicates the balance naturally through voice.

### 3. Card Blocking

For a lost or compromised card, the agent:

1. Authenticates the customer.
2. Collects the last four digits of the card.
3. Collects the reason for blocking.
4. Invokes:

```text
abirami_block_card
```

5. The abirami_block_card API blocks the card, generates a ticket/reference number, and updates the user's action in the database.
6.The agent reads the ticket/reference number back to the customer.


### 4. Confirmation

After a successful card block, the customer can request an email confirmation.

The agent invokes:

```text
abirami_send_email_confirmation
```

The confirmation contains the customer's name, ticket number, and card-block confirmation.

## Database

A PostgreSQL `accounts` table is used for the demonstration.

The database contains multiple fake customer accounts with different balances.

Example:

| ID | Account Number | Customer     | Balance |
| -: | -------------- | ------------ | ------: |
|  1 | 100001         | Ananya Rao   |   25000 |
|  2 | 100002         | Rahul Kumar  |   42000 |
|  3 | 100003         | Priya Sharma |   18500 |

All data used for the demonstration is fictional test data.

## Authentication

Authentication uses:

```text
Account Number + 4-digit PIN
```

The backend validates the supplied credentials against the PostgreSQL database.

On successful authentication, the backend generates a short-lived JWT authentication token.

The token is used for subsequent authenticated operations.

The PIN is never returned to the caller and is not revealed by the voice assistant.

## API Tools

The AIDA agent is configured with the following backend tools:

| Tool                             | Purpose                                   |
| -------------------------------- | ----------------------------------------- |
| `abirami_authenticate_customer`  | Authenticate customer                     |
| `abirami_get_account_balance`    | Retrieve account balance                  |
| `abirami_block_card`             | Block a customer card and Store the user's 
                                    latest card-block action                   |
| `abirami_send_email_confirmation`| Send confirmation email                   |

## Setup

### Prerequisites

* Node.js
* PostgreSQL
* Git
* Enterprise Bot AIDA account/access
* Required email service credentials

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file:

```env
DATABASE_URL=<your-postgresql-connection-string>
JWT_SECRET=<your-jwt-secret>
API_KEY=<your-api-key>
EMAIL_API_KEY=<your-email-api-key>
```

Do not commit `.env` or any secrets to GitHub.

### Start the application

```bash
npm start
```

The application exposes the backend APIs required by the AIDA tools.

## Deployment

The backend is deployed on Render.

The deployed API endpoints are configured as tools in the Enterprise Bot AIDA platform.

## Error Handling

The backend handles:

* Missing credentials
* Invalid account number
* Invalid PIN
* Account not found
* Authentication failures
* Database failures
* Card blocking failures
* Ticket generation failures
* Notification failures

The agent is instructed not to reveal account information when authentication fails.

## Security Considerations

* Authentication is required before account information is accessed.
* Authentication tokens are short-lived.
* PIN values are never returned to the caller.
* Real customer information is not used in the demonstration.
* Secrets and API credentials are stored as environment variables.
* Backend APIs validate authentication before protected operations.

## Demo

A 1–2 minute demonstration video shows:

1. Customer requesting an account balance through voice.
2. Agent requesting account number and PIN.
3. Authentication tool being invoked.
4. Successful authentication.
5. Balance lookup tool being invoked.
6. Account balance being returned through voice.

## Improvements With More Time

With more time, I would improve the solution by adding stronger authentication such as OTP-based verification, implementing rate limiting and account lockout for repeated failed attempts, and adding centralized monitoring and tracing for all agent tool calls. I would also improve the card-block workflow with stronger transaction validation and retry handling for notification failures.
