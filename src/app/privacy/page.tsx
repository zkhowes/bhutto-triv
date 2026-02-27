import Link from "next/link";

export const metadata = {
  title: "Privacy Policy – Bhutto Wisdom",
  description: "Privacy Policy for Bhutto Wisdom competitive trivia game.",
};

export default function PrivacyPage() {
  const lastUpdated = "February 21, 2026";

  return (
    <div className="min-h-screen bg-[#0f0f23] text-[#e8e8e8]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-[#a0a0b8] hover:text-[#e8e8e8] transition-colors mb-6 inline-block"
          >
            ← Back to Bhutto Wisdom
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-[#a0a0b8] text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-[#c8c8d8] leading-relaxed">

          {/* Introduction */}
          <section>
            <p>
              Bhutto Wisdom (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) operates a competitive
              daily trivia game at <strong className="text-white">bwiz.zkhowes.fun</strong>. This Privacy Policy
              explains what information we collect, how we use it, and your choices regarding that information.
            </p>
            <p className="mt-3">
              By creating an account and using Bhutto Wisdom, you agree to the practices described in this policy.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Data We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">1a. Information from Google Sign-In</h3>
            <p className="mb-3">
              We use Google OAuth as our only sign-in method. When you sign in, Google provides us with:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2 mb-4">
              <li><strong className="text-white">Name</strong> — your full name as set on your Google account</li>
              <li><strong className="text-white">Email address</strong> — used to identify your account</li>
              <li><strong className="text-white">Profile picture URL</strong> — used as a default avatar</li>
            </ul>
            <p className="text-sm text-[#a0a0b8]">
              We do not receive your Google password. Authentication is handled entirely by Google.
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">1b. Profile Information You Provide</h3>
            <p className="mb-3">
              During account setup, you provide:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <strong className="text-white">Nickname</strong> — your display name shown to other players
                in your leagues
              </li>
              <li>
                <strong className="text-white">Phone number</strong> — used exclusively to send you SMS game
                notifications (see Section 2). Providing a phone number is required to complete registration.
              </li>
              <li>
                <strong className="text-white">Timezone</strong> — used to display game deadlines and timestamps
                in your local time
              </li>
              <li>
                <strong className="text-white">Avatar image</strong> — an optional profile picture you upload
                or generate using our AI avatar tool
              </li>
            </ul>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">1c. Game Activity Data</h3>
            <p className="mb-3">We store data you generate while playing:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Questions you submit, including the question text, correct answer, and category</li>
              <li>Answers and bets you place each round</li>
              <li>Points, scores, and placement history across games and seasons</li>
              <li>League memberships and roles (player or commissioner)</li>
              <li>Timestamps of your activity (logins, submissions, grading actions)</li>
            </ul>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">1d. Notification Interaction Data</h3>
            <p>
              When we send you a notification, we record whether the SMS link was clicked and when, so
              commissioners and administrators can understand how notifications are performing. This data is
              never shared or sold.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* How We Use Information */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">2a. Game Operation</h3>
            <p>
              We use your account data, game activity, and preferences to operate the game: displaying your
              scores, tracking league standings, facilitating AI-graded answers, and managing the round-based
              gameplay.
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">2b. SMS Game Notifications</h3>
            <p className="mb-3">
              <strong className="text-white">We use your phone number solely to send you transactional
              game notifications.</strong> We do not use it for marketing, promotions, or any purpose
              unrelated to the game. We do not sell or share your phone number with any third party.
            </p>
            <p className="mb-3">SMS messages may be sent for the following in-game events:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>It is your turn to submit a question (&ldquo;at bat&rdquo;)</li>
              <li>A new question is ready and betting is open</li>
              <li>All answers are in and it is time for you to grade</li>
              <li>You are on deck (next in the batting order)</li>
              <li>Round results are available</li>
              <li>A game deadline is approaching and you have not yet submitted</li>
            </ul>
            <p className="mt-3 text-sm text-[#a0a0b8]">
              Message frequency varies depending on game activity. Message and data rates may apply.
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">2c. Session and Security</h3>
            <p>
              We maintain authenticated sessions using encrypted cookies managed by NextAuth. Your email
              address is used to link your Google account to your Bhutto Wisdom account and to identify
              your session.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* SMS Opt-Out */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. SMS Opt-Out</h2>
            <p className="mb-4">
              You have full control over SMS notifications. You can opt out at any time using either method:
            </p>
            <div className="bg-[#16213e] rounded-xl border border-[#1e3a5f] p-5 space-y-4">
              <div>
                <p className="font-semibold text-white mb-1">Reply STOP to any message</p>
                <p className="text-sm">
                  Reply <strong className="text-[#e94560]">STOP</strong> to any SMS you receive from us and
                  your number will be immediately removed from all future messages. Reply{" "}
                  <strong className="text-[#e94560]">HELP</strong> for assistance.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Notification preferences in your profile</p>
                <p className="text-sm">
                  Sign in and go to <strong className="text-white">Profile</strong> (top-right menu → Profile).
                  Under <em>Notification Preferences</em>, select <strong>None</strong> to disable all SMS,
                  or choose <strong>Low</strong> (essential game-play alerts only) or{" "}
                  <strong>High</strong> (all notifications). Your preference overrides the setting your
                  league commissioner has configured.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Third Parties */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Third-Party Services</h2>
            <p className="mb-3">We use a small set of third-party services to operate the game:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-white">Google OAuth</strong> — handles sign-in authentication.
                Governed by{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3b82f6] hover:underline"
                >
                  Google&rsquo;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-white">Mosio</strong> — delivers SMS messages to your phone number.
                Mosio receives your phone number and the message text only. Governed by{" "}
                <a
                  href="https://www.mosio.com/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3b82f6] hover:underline"
                >
                  Mosio&rsquo;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-white">Neon (PostgreSQL)</strong> — stores your account and game
                data in a secure, managed database.
              </li>
              <li>
                <strong className="text-white">Anthropic Claude</strong> — AI-powered answer grading and
                question workshop. Answer text may be sent to Anthropic&rsquo;s API for evaluation.
                Governed by{" "}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3b82f6] hover:underline"
                >
                  Anthropic&rsquo;s Privacy Policy
                </a>.
              </li>
              <li>
                <strong className="text-white">Vercel</strong> — hosts the application and processes
                web requests.
              </li>
            </ul>
            <p className="mt-4">
              We do not sell your personal information to any third party. We do not share your phone number
              with any third party except Twilio for the sole purpose of delivering game notifications.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention</h2>
            <p className="mb-3">
              Your account data is retained as long as your account is active. Game history (scores,
              answers, questions) is retained indefinitely to maintain the integrity of league records and
              hall-of-fame standings.
            </p>
            <p>
              If you wish to have your account deleted, contact the application administrator. Upon deletion,
              your personal information (name, email, phone number, avatar) will be removed. Historical game
              records may be retained in anonymized form.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Children */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Children&rsquo;s Privacy</h2>
            <p>
              Bhutto Wisdom is not directed at children under 13. We do not knowingly collect personal
              information from children under 13. If you believe a child has provided us with their
              information, please contact us and we will promptly delete it.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at
              the top of this page reflects when changes were last made. Continued use of the application
              after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Contact</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your data rights, please
              contact the application administrator through your league commissioner or by reaching out
              directly to the site operator.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-[#1e3a5f] flex gap-6 text-sm text-[#a0a0b8]">
          <Link href="/terms" className="hover:text-[#e8e8e8] transition-colors">
            Terms &amp; Conditions
          </Link>
          <Link href="/" className="hover:text-[#e8e8e8] transition-colors">
            Back to Game
          </Link>
        </div>
      </div>
    </div>
  );
}
