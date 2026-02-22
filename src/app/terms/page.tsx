import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions – Bhutto Wisdom",
  description: "Terms and Conditions for Bhutto Wisdom competitive trivia game.",
};

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Terms &amp; Conditions</h1>
          <p className="text-[#a0a0b8] text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-[#c8c8d8] leading-relaxed">

          {/* Introduction */}
          <section>
            <p>
              These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of Bhutto Wisdom
              (&ldquo;the Service&rdquo;), a competitive daily trivia game operated at{" "}
              <strong className="text-white">bwiz.zkhowes.fun</strong>. By creating an account or using
              the Service, you agree to these Terms.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Eligibility and Account</h2>
            <p className="mb-3">
              You must be at least 13 years old to use Bhutto Wisdom. By registering, you represent that
              you meet this requirement.
            </p>
            <p className="mb-3">
              You are responsible for maintaining the confidentiality of your account. You agree to provide
              accurate information — including a valid phone number — during registration. Your phone number
              is used exclusively to deliver game-related SMS notifications as described in Section 4.
            </p>
            <p>
              Accounts are personal and may not be shared or transferred. We reserve the right to suspend
              or terminate accounts that violate these Terms.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* The Game */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. The Game</h2>
            <p className="mb-3">
              Bhutto Wisdom is a round-based trivia game played within private leagues. Each league is
              managed by a commissioner who controls league settings and membership. Players take turns
              submitting questions, while all other players bet points and answer. Scoring follows an
              F1-style points system.
            </p>
            <p className="mb-3">
              By submitting a question, you represent that you have the right to submit it and that it
              does not infringe on any third-party copyright. We do not claim ownership of user-submitted
              content, but you grant us a non-exclusive license to store and display it within the game.
            </p>
            <p>
              AI-powered grading is used to evaluate free-text answers. AI grading results may be reviewed
              and overridden by the question submitter. We do not guarantee that AI grading will be correct
              in all cases.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Acceptable Use */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Submit questions or answers that are abusive, harassing, obscene, or unlawful</li>
              <li>Attempt to manipulate game outcomes through technical exploits or collusion</li>
              <li>Use automated tools (bots, scripts) to interact with the game</li>
              <li>Impersonate another player or misrepresent your identity</li>
              <li>Interfere with the operation of the Service or its infrastructure</li>
            </ul>
            <p className="mt-3">
              Commissioners are responsible for the conduct of players within their leagues and may remove
              players who violate these Terms or their league&rsquo;s rules.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* SMS Notifications */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. SMS Notifications</h2>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">4a. Consent</h3>
            <p className="mb-4">
              By providing your phone number during registration, you expressly consent to receive
              automated SMS text messages from Bhutto Wisdom at the phone number provided. These messages
              are transactional in nature — they relate solely to active game events in leagues you have
              joined. You are not required to consent to receive SMS messages as a condition of any
              purchase or service.
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">4b. Notification Types</h3>
            <p className="mb-3">
              Depending on your notification level (set by you or your league commissioner), you may
              receive SMS messages for the following game events:
            </p>
            <div className="bg-[#16213e] rounded-xl border border-[#1e3a5f] overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    <th className="text-left px-4 py-3 text-[#a0a0b8] font-medium uppercase text-xs tracking-wider">
                      Event
                    </th>
                    <th className="text-left px-4 py-3 text-[#a0a0b8] font-medium uppercase text-xs tracking-wider">
                      Recipient
                    </th>
                    <th className="text-left px-4 py-3 text-[#a0a0b8] font-medium uppercase text-xs tracking-wider">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e3a5f]/50">
                  <tr>
                    <td className="px-4 py-3 text-white">You&rsquo;re up — submit your question</td>
                    <td className="px-4 py-3">At-bat player</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded">
                        Low + High
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-white">New question ready — get your bets in</td>
                    <td className="px-4 py-3">All other players</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded">
                        Low + High
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-white">All answers in — time to grade</td>
                    <td className="px-4 py-3">At-bat player</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded">
                        Low + High
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-white">You&rsquo;re on deck — start preparing</td>
                    <td className="px-4 py-3">On-deck player</td>
                    <td className="px-4 py-3">
                      <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded">
                        Low only
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-white">Round results are available</td>
                    <td className="px-4 py-3">All players</td>
                    <td className="px-4 py-3">
                      <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded">
                        High only
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-white">Deadline approaching — submit soon</td>
                    <td className="px-4 py-3">Player who hasn&rsquo;t submitted</td>
                    <td className="px-4 py-3">
                      <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded">
                        High only
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">4c. Notification Levels</h3>
            <p className="mb-3">
              Three notification levels control which SMS messages you receive:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2 mb-4">
              <li>
                <strong className="text-white">None</strong> — No SMS messages. Notifications appear
                in-app only.
              </li>
              <li>
                <strong className="text-white">Low</strong> — Essential alerts only: your turn to submit
                a question, a new question is available, and it is time to grade. Minimum notifications
                needed to keep the game moving.
              </li>
              <li>
                <strong className="text-white">High</strong> — All alerts including round results and
                deadline warnings.
              </li>
            </ul>
            <p className="mb-4">
              Your league commissioner sets a default level for the league. You can override this for
              your own account at any time from your Profile settings (see Section 4e).
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">4d. Message Frequency</h3>
            <p className="mb-4">
              Message frequency depends on game activity within your leagues. In an active league, you may
              receive several messages per day. Leagues that are paused or between games will generate no
              messages.
            </p>
            <p className="mb-4 font-medium text-white">
              Message and data rates may apply.
            </p>

            <h3 className="text-base font-semibold text-[#e8e8e8] mb-2">4e. How to Opt Out</h3>
            <div className="bg-[#16213e] rounded-xl border border-[#1e3a5f] p-5 space-y-4">
              <div>
                <p className="font-semibold text-white mb-1">Reply STOP</p>
                <p className="text-sm">
                  Reply <strong className="text-[#e94560]">STOP</strong> to any SMS message to
                  unsubscribe immediately from all future messages. Reply{" "}
                  <strong className="text-[#e94560]">HELP</strong> for help or support information.
                  After opting out via STOP, you will not receive further SMS messages unless you
                  re-enable notifications in your profile.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Notification Preferences in Profile</p>
                <p className="text-sm">
                  You can change your notification level at any time:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2 mt-2 text-sm">
                  <li>Sign in at <strong className="text-white">bwiz.zkhowes.fun</strong></li>
                  <li>Click your avatar or name in the top navigation bar</li>
                  <li>Select <strong className="text-white">Profile</strong></li>
                  <li>
                    Scroll to <em>Notification Preferences</em> and select{" "}
                    <strong className="text-white">None</strong> to disable all SMS
                  </li>
                  <li>Save your profile</li>
                </ol>
                <p className="mt-2 text-sm">
                  Your preference takes effect immediately and overrides any setting your league
                  commissioner has configured.
                </p>
              </div>
            </div>

            <h3 className="text-base font-semibold text-[#e8e8e8] mt-5 mb-2">4f. SMS Provider</h3>
            <p>
              SMS messages are delivered via <strong className="text-white">Twilio</strong>. Messages
              will originate from a Twilio-provisioned number. Carrier message and data rates may apply.
              Twilio is not responsible for delayed or undelivered messages.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Intellectual Property</h2>
            <p className="mb-3">
              The Bhutto Wisdom application, including its design, code, and branding, is owned by the
              operator. You may not copy, reproduce, or distribute any part of the Service without
              written permission.
            </p>
            <p>
              User-submitted content (questions, answers) remains the property of the submitter. By
              submitting content, you grant us a license to store, display, and use it within the
              game platform.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Disclaimers and Limitation of Liability</h2>
            <p className="mb-3">
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
              guarantee uninterrupted access, error-free operation, or accuracy of AI-graded answers.
            </p>
            <p className="mb-3">
              To the extent permitted by applicable law, we are not liable for any indirect, incidental,
              or consequential damages arising from your use of the Service, including any loss of game
              progress, scores, or data.
            </p>
            <p>
              Competitive game outcomes (points, standings, awards) are final once a season is completed
              and are not subject to reversal except at the commissioner&rsquo;s discretion within an
              active season.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States and the state in which the
              operator resides, without regard to conflict of law principles. Any disputes arising
              from these Terms shall be resolved through good-faith negotiation before resorting to
              formal legal proceedings.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Changes */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Changes to These Terms</h2>
            <p>
              We may update these Terms at any time. The &ldquo;Last updated&rdquo; date at the top
              of this page indicates when changes were last made. Continued use of the Service after
              changes are posted constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <hr className="border-[#1e3a5f]" />

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Contact</h2>
            <p>
              Questions about these Terms or the Service can be directed to the application administrator
              via your league commissioner or through the contact information provided in your league.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-[#1e3a5f] flex gap-6 text-sm text-[#a0a0b8]">
          <Link href="/privacy" className="hover:text-[#e8e8e8] transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="hover:text-[#e8e8e8] transition-colors">
            Back to Game
          </Link>
        </div>
      </div>
    </div>
  );
}
