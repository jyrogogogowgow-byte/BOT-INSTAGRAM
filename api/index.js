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

// 🧠 ذاكرة مؤقتة لتخزين روابط الريلز للمستخدمين
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
          const messageId = event.message && event.message.mid;

          if (!senderId) return;

          // 🆕 التعامل مع postbacks (اختيار الزر)
          if (event.postback && event.postback.payload) {
            const payload = event.postback.payload;
            const reelUrl = userReels[senderId]; // نحصل على آخر ريلز للمستخدم

            if (!reelUrl) {
              await sendReply(senderId, "⚠️ لم أجد ريلز محفوظ لك. أرسل ريلز جديد من فضلك.");
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
                userReels[senderId] = reelUrl; // 🧠 نحفظ الرابط للمستخدم

                // ⬇️ نرسل القالب باش يختار نوع الملف
                await sendChooseTypeTemplate(senderId);

                console.log(`🎬 تم حفظ ريلز المستخدم (${senderId}): ${reelUrl}`);
                return;
              }
            }

            if (!reelFound) {
              await sendReply(senderId, "🚨 المرفق غير مدعوم. يُرجى إرسال مقطع ريلز فقط.");
            }
          } else {
            await sendReply(senderId, "📩 يُرجى إرسال مقطع ريلز ليتم تحميله.");
          }
        });
      }
    });

    return res.sendStatus(200);
  }

  res.sendStatus(404);
});

async function sendGenericTemplate(recipientId) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [
                {
                  title: "BOT REELS 🔮",
                  image_url: "https://tse3.mm.bing.net/th/id/OIP.iXKBvwJYAyDkvJ6el5JcnQHaEK?r=0&rs=1&pid=ImgDetMain&o=7&rm=3",
                  subtitle: "افضل بوت لي تحميل ريلز انستغرام بي ضغطت زر واحدة ",
                  default_action: {
                    type: "web_url",
                    url: "https://www.instagram.com/am_mo111_25_"
                  },
                  buttons: [
                    {
                      type: "web_url",
                      url: "https://www.instagram.com/am_mo111_25_/reel/DLij9OfIjfj/",
                      title: "شرح البوت 🎈"
                    },
                    {
                      type: "web_url",
                      url: "https://www.instagram.com/li9ama_simo",
                      title: "مطور البوت 🎴"
                    },
                    {
                      type: "web_url",
                      url: "https://whatsapp.com/channel/0029VbAgby79sBICj1Eg7h0h",
                      title: "📞 WhatsApp Channel"
                    }
                  ]
                }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      }
    );

    console.log("✅ تم إرسال القالب بنجاح.");
  } catch (err) {
    console.error("❌ خطأ في إرسال القالب:", err.response ? err.response.data : err.message);
  }
}

// 🆕 قالب اختيار نوع المقطع (فيديو / صوتي)
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
                {
                  type: "postback",
                  title: "🎞️ مقطع فيديو",
                  payload: "TYPE_VIDEO"
                },
                {
                  type: "postback",
                  title: "🎧 مقطع صوتي",
                  payload: "TYPE_AUDIO"
                }
              ]
            }
          }
        },
        messaging_type: "RESPONSE"
      }
    );

    console.log("✅ تم إرسال قالب الاختيار بنجاح.");
  } catch (err) {
    console.error("❌ خطأ في إرسال قالب الاختيار:", err.response ? err.response.data : err.message);
  }
}

// 🆕 إرسال الفيديو أو الصوت حسب الاختيار
async function sendMedia(senderId, url, type = "video") {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        messaging_type: "RESPONSE",
        recipient: { id: senderId },
        message: {
          attachment: {
            type: type, // 🎞️ أو 🎧 حسب الاختيار
            payload: { url: url }
          }
        }
      }
    );

    if (response.status === 200) {
      console.log(`✅ تم إرسال ${type} بنجاح.`);
      if (type === "video") {
        await postVideoToFacebook(url, "📥 تم نشر الفيديو تلقائياً من البوت 🎬");
      }
    } else {
      await sendReply(senderId, `❌ حدث خطأ أثناء إرسال ${type}.`);
    }
  } catch (error) {
    console.error(`❌ خطأ في إرسال ${type}:`, error.message);
    await sendReply(senderId, `❌ وقع خطأ أثناء إرسال ${type}.`);
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

// 🆕 دالة نشر الفيديو على فيسبوك
async function postVideoToFacebook(videoUrl, caption = "📲 فيديو تم تحميله تلقائياً") {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/${FACEBOOK_PAGE_ID}/videos`,
      new URLSearchParams({
        file_url: videoUrl,
        description: caption,
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (response.data && response.data.id) {
      console.log("✅ تم نشر الفيديو على الصفحة بنجاح. Video ID:", response.data.id);
    } else {
      console.log("⚠️ تم إرسال الطلب ولكن ما تمش النشر.");
    }
  } catch (err) {
    console.error("❌ خطأ أثناء نشر الفيديو على صفحة فيسبوك:", err.response ? err.response.data : err.message);
  }
}

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Instagram bot running...');
});
