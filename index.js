const {Client,Intents} = require('discord.js');
const {prefix,token} = require("./config.json");
const ytdl = require("ytdl-core");

const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

const queue = new Map();
//=======================================ตั้งค่าการแจ้งเตือนสถานะบอทบน cmd=======================================
client.once("ready", () => {
    console.log(`${client.user.username} is Online`);
});

client.once("reconnecting", () => {
    console.log("Reconnecting!!");
});

client.once("disconnect", () => {
    console.log("Disconnect!!");
});

//=======================================ฟังค์ชั่น รับค่าการทำงานจากข้อความ=======================================
client.on("message", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;

    const serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
        return;
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
        return;
    } else {
        message.channel.send("คุณต้องใช้คำสั่งที่ถูกต้อง");
    }
});

//=======================================ฟังค์ชั่น แจ้งเตือน=======================================
async function execute(message, serverQueue) {
    const args = message.content.split(" ");

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel)
        return message.channel.send(
            "เข้าห้องก่อนเล่นเพลง!"
        );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send(
            "โปรดอณุญาติในการเข้าช่องเสียง"
        );
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };

        queue.set(message.guild.id, queueContruct);

        queueContruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueContruct.connection = connection;
            play(message.guild, queueContruct.songs[0]);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err);
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send(`✅${song.title} เพิ่มลงในคิว!`);
    }
}
//=======================================ฟังค์ชั่น ข้ามเพลง=======================================
function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "โปรดเข้าห้องเสียงเพื่อข้ามเพลง!"
        );
    if (!serverQueue)
        return message.channel.send("ไม่มีเพลงให้ Skip!");
    serverQueue.connection.dispatcher.end();
}
//=======================================ฟังค์ชั่น หยุดเพลง=======================================
function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send(
            "Sorry โปรดเข้าห้องเสียงเพื่อหยุดเพลง!"
        );

    if (!serverQueue)
        return message.channel.send("ไม่มีเพลงให้ Stop!");

    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end();
}
//=======================================ฟังค์ชั่น เริ่มเพลง=======================================
function play(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection
        .play(ytdl(song.url))
        .on("เสร็จสิ้น", () => {
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 3);
    serverQueue.textChannel.send(`✅เพิ่ม: **${song.title}** ลงคิวเพลงสำเร็จ!!`);
}

client.login(token);