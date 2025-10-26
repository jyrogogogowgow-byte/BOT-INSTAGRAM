const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = "IGAAKBNjRZBjsNBZAFJjRWRySHRicGtpRy1qUXBteFJCNGZAZARHhybTF2YWVxY29qMDNBS0dSNk5DdEh6d3NzRGVPQkI3YUJvbnZAWS2RKSElzY1ZAvbDZAGaURBcVlCTm5oSm9OVU45cnQzQVB3X003MzRVVkFGQ0FkT2E4V3pMcHpXbwZDZD";
const VERIFY_TOKEN = "abcd1234";

// 🔵 إعدادات فيسبوك
const FACEBOOK_PAGE_ID = "225597157303578";
const FACEBOOK_PAGE_ACCESS_TOKEN = "EAAHa6OnUvf8BPTNccoszJ4xxXlwZAY3qGaN8yLWRHCrL7hmctM6mM6NWbu5LIFtQPcQU9jCNsi1prFp9DIlwSVbNSzZAxLeafXjVDZAUvZCea0Tu8Nzx897JyJT4mCm4wDJTIvcqICplk7ZBeUAQzsgLZBAbxce4ZCXK5dJpfrCy7mtNVZA5NfJw8B7ZAEiO7DYEWvjuFL7AZD";

// 🧠 ذاكرة مؤقتة
const userReels = {};

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  console.log("📦 Payload:", JSON.stringify(req.body, null, 2));

  if (req.body.object === 'instagram') {
    req.body.entry.forEach(entry => {
      if (entry.messaging) {
        entry.messaging.forEach(async (event) => {
          const senderId = event.sender && event.sender.id;
          if (!senderId) return;

          // 🧩 نتحقق هل المستخدم متابع قبل أي شيء
          const isFollowing = await isUserFollowingMe(senderId);
          if (!isFollowing) {
            await sendReply(senderId, "🚫 يجب أن تتابع حسابنا أولاً لاستخدام البوت ❤️‍🔥\n👉 https://www.instagram.com/am_mo111_25_");
            return;
          }

          // 🆕 التعامل مع postbacks (اختيار الزر)
          if (event.postback && event.postback.payload) {
            const payload = event.postback.payload;
            const reelUrl = userReels[senderId];
            if (!reelUrl) {
              await sendReply(senderId, "⚠️ أرسل ريلز جديد أولاً.");
              return;
            }

            if (payload === "TYPE_VIDEO") {
              await sendReply(senderId, "🎞️ جاري إرسال المقطع كفيديو...");
              await sendMedia(senderId, reelUrl, "video");
              return;
            }

            if (payload === "TYPE_AUDIO") {
              await sendReply(senderId, "🎧 جاري إرسال المقطع كصوت...");
              await sendMedia(senderId, reelUrl, "audio");
              return;
            }
          }

          if (event.message && event.message.text) {
            await sendGenericTemplate(senderId);
            return;
          }

          if (event.message && event.message.attachments) {
            let reelFound = false;

            for (const attachment of event.message.attachments) {
              if (attachment.type === 'ig_reel' && attachment.payload && attachment.payload.url) {
                reelFound = true;
                const reelUrl = attachment.payload.url;
                userReels[senderId] = reelUrl;
                await sendChooseTypeTemplate(senderId);
                console.log(`🎬 تم حفظ ريلز المستخدم (${senderId}): ${reelUrl}`);
                return;
              }
            }

            if (!reelFound) {
              await sendReply(senderId, "🚨 أرسل فقط مقطع ريلز.");
            }
          } else {
            await sendReply(senderId, "📩 أرسل مقطع ريلز للتحميل.");
          }
        });
      }
    });
    return res.sendStatus(200);
  }
  res.sendStatus(404);
});

// 🆕 التحقق هل المستخدم متابع الحساب
async function isUserFollowingMe(userId) {
  try {
    const response = await axios.get(`https://graph.instagram.com/v21.0/me/followers`, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });

    if (response.data && response.data.data) {
      const followers = response.data.data.map(f => f.id);
      return followers.includes(userId);
    }
    return false;
  } catch (err) {
    console.error("❌ خطأ أثناء التحقق من المتابعة:", err.response ? err.response.data : err.message);
    return false;
  }
}

async function sendChooseTypeTemplate(recipientId) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: "🎬 اختر نوع المقطع الذي ترغب في تحميله:",
              buttons: [
                { type: "postback", title: "🎞️ مقطع فيديو", payload: "TYPE_VIDEO" },
                { type: "postback", title: "🎧 مقطع صوتي", payload: "TYPE_AUDIO" }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      }
    );
  } catch (err) {
    console.error("❌ خطأ في إرسال قالب الاختيار:", err.response ? err.response.data : err.message);
  }
}

async function sendMedia(senderId, url, type = "video") {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: {
          attachment: { type: type, payload: { url: url } }
        }
      }
    );

    if (response.status === 200) {
      console.log(`✅ تم إرسال ${type} بنجاح.`);
    }
  } catch (err) {
    console.error(`❌ خطأ في إرسال ${type}:`, err.response ? err.response.data : err.message);
  }
}

async function sendReply(recipientId, messageText) {
  try {
    await axios.post(`https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      recipient: { id: recipientId },
      message: { text: messageText },
      messaging_type: "RESPONSE"
    });
  } catch (err) {
    console.error("❌ فشل في إرسال الرسالة:", err.response ? err.response.data : err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Instagram bot running...');
});
