# Direct ordering test configuration

The user explicitly enabled order requests and replaced the WhatsApp destination with **0504453592** (`972504453592`) for testing. The business telephone remains **0528767206**. The destination is stored in Atlas business settings and mirrored in the initial UI defaults. Restore the business WhatsApp destination in admin before directing real customers to the site; changing a number clears its verification until confirmed again.

Checkout now validates the form, saves a `pending_confirmation` request in MongoDB, and navigates directly to the WhatsApp URL returned by the server. There is no message-preview or extra review step. WhatsApp still requires the customer to press Send; opening the URL is not proof of delivery or business confirmation. A fallback link is provided if WhatsApp does not open.

Operational controls remain: server enable flag, admin open/closed control, verified destination, owner acceptance of requests, pickup dates/times, stock and daily limits. Image and catalog approval fields are separate publishing records and were not marked approved by this change. The site has not been externally published and remains noindex.

Automated browser tests use an isolated test database and intercept `wa.me` navigation. They verify direct handoff and the prepared message without sending messages. No automated test order was sent to the business or the user's phone.
