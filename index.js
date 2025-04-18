const fs = require('fs')
const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js')
const { timeStamp } = require('console')

const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]})

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`)
})

let adminID = '324291675478556682'
let dataPath = './data/'
let ext = '.json'
let blacklistFile = './blacklist.json'

client.on(Events.MessageCreate, async message => {
	if (message.guildId != '1150788571331039254') return
	// if (message.guildId != '819581870740209724') return

    let blacklist = fs.readFileSync('blacklist.json')
    if (blacklist.includes(message.author.id)) return

    // starts with + or - and no whitespace after
    if (!(/[+|-][^\s]/.test(message.content))) return
    let args = message.content.slice(1).toLowerCase().split(' ')
    let isPlus = message.content[0] === '+'

    let filenames = fs.readdirSync(dataPath)

    switch (args[0]) {
        case 'user':
            if (message.author.id != adminID) break
            if (!isPing(args[1])) break

            if (isPlus) fs.writeFileSync(dataPath + toID(args[1]) + ext, JSON.stringify({end:Date.now()}, null, 4))
            else fs.unlinkSync(dataPath + toID(args[1]) + ext)

            updateDedicatedChannelStatusMessage()
            indicateSuccess(message)
            return

        case 'list':
        case 'status':
            const statusEmbed = new EmbedBuilder()
                .setColor(0xFF1144)
                .setTitle('DURATIONS')
                .setFooter({ text: 'List does not self-update, run again after editing a time.' })

            for (let file of filenames) try {
                let timestamp = JSON.parse(fs.readFileSync(dataPath + file))?.['end']
                statusEmbed.addFields({
                    name: (await message.guild.members.fetch(file.split('.')[0])).displayName,
                    value: Date.now() < timestamp ? (timestamp > Number.MAX_SAFE_INTEGER ? '\`Never\`' : '<t:' + Math.ceil(timestamp / 1000) + ':R>') : '\`Time completed\`',
                    inline: true
                })
            } catch(err) {
                // TODO
            }

            message.channel.send({ embeds: [statusEmbed] })
            indicateSuccess(message)
            return

        case 'reset':
            for (let file of filenames) if (file.includes((await message.channel.messages.fetch(message.reference.messageId)).author.id)) {
                let path = dataPath + file
                let newData = JSON.parse(fs.readFileSync(path))
                newData['end'] = Date.now()
                fs.writeFileSync(path, JSON.stringify(newData, null, 4))

                indicateSuccess(message)
                return
            }

            updateDedicatedChannelStatusMessage()
            indicateSuccess(message)
            return

        case 'blacklist':
            if (message.author.id != adminID) break
            if (!isPing(args[1])) break

            blacklist = fs.existsSync(blacklistFile) ? fs.readFileSync(blacklistFile) : []
            let list = JSON.parse(blacklist)
            if (list.includes(toID(args[1]))) {
                if (isPlus) {
                    message.react('☑️')
                } else {
                    let rmIndex = list.indexOf(toID(args[1]))
                    if (rmIndex > -1) {
                        list.splice(rmIndex, 1)
                        fs.writeFileSync(blacklistFile, JSON.stringify(list, null, 4))
                        indicateSuccess(message)
                    } else message.react('❌')
                }
                return
            } else if (!isPlus) break

            list.push(toID(args[1]))
            fs.writeFileSync(blacklistFile, JSON.stringify(list, null, 4))

            indicateSuccess(message)
            return

        default:
            // is number
            if (!(/^\d*\.?\d+$/.test(args[0]))) return
            if (message.reference == null) return

            let appendedTime = args[0]
            if (args.length == 1) appendedTime *= 360000 // default to hours
            else if (interpretTimeMultiplier(args[1]) === null) return
            else appendedTime *= interpretTimeMultiplier(args[1])
            appendedTime *= (isPlus ? 1 : -1)

            for (let file of filenames) if (file.includes((await message.channel.messages.fetch(message.reference.messageId)).author.id)) {
                let path = dataPath + file
                let data = JSON.parse(fs.readFileSync(path))

                if (file.includes(message.author.id)) break; // nuh uh

                if (Date.now() > data['end']) data['end'] = Date.now() + appendedTime
                else data['end'] += appendedTime
                if (data['end'] > Number.MAX_SAFE_INTEGER) data['end'] = Number.MAX_SAFE_INTEGER + 1
                fs.writeFileSync(path, JSON.stringify(data, null, 4))

                updateDedicatedChannelStatusMessage()
                indicateSuccess(message)
                return
            }

            message.react('❌')
            return
    }

    message.react('⁉️')
})

function indicateSuccess(message) {
    message.react('✅')
    setTimeout(() => {
        message.reactions.removeAll()
    }, 4000);
}

async function updateDedicatedChannelStatusMessage() {
    const statusEmbed = new EmbedBuilder()
        .setColor(0x4287f5)
        .setTitle('DURATIONS')
        .setFooter({ text: 'List automatically updates.' })

    let channel = client.channels.cache.get('1362276483393126541')
    channel.messages.fetch('1362278226113597482').then(async message => {
        for (let file of fs.readdirSync(dataPath)) try {
            let timestamp = JSON.parse(fs.readFileSync(dataPath + file))?.['end']
            statusEmbed.addFields({
                name: (await message.guild.members.fetch(file.split('.')[0])).displayName,
                value: Date.now() < timestamp ? (timestamp > Number.MAX_SAFE_INTEGER ? '\`Never\`' : '<t:' + Math.ceil(timestamp / 1000) + ':R>') : '\`Time completed\`',
                inline: true
            })
        } catch(err) {
            // TODO
        }

        message.edit({embeds: [statusEmbed]})
    })
}

// LAZY ASF
function interpretTimeMultiplier(str) {
    switch (str) {
        case 'ms':
        case 'millisecond':
        case 'milliseconds':
            return 0

        case 's':
        case 'sec':
        case 'secs':
        case 'second':
        case 'seconds':
            return 1000

        case 'm':
        case 'min':
        case 'mins':
        case 'minute':
        case 'minutes':
            return 60000

        case 'h':
        case 'hour':
        case 'hours':
            return 3600000

        case 'd':
        case 'day':
        case 'days':
            return 86400000

        case 'w':
        case 'week':
        case 'weeks':
            return 604800000

        case 'month':
        case 'months':
            return 86400000 * 29.531

        case 'y':
        case 'year':
        case 'years':
            return 31556952000 + 86400000 / 4 // leap days

        case 'forever':
        case 'eternity':
        case 'eternitys':
        case 'eternities':
        case 'infinity':
        case 'infinitys':
        case 'infinities':
        case 'never':
            return Number.MAX_SAFE_INTEGER // a lot but not so much that it breaks

        default:
            break
    }

    return null
}

function isPing(ping) {
    return /[<][@]\d{18}[>]/.test(ping)
}

function toID(str) {
    return str.match(/\d{18}/)[0]
}

function toPing(id) {
    return '<@' + id + '>'
}

client.login(require('./token.json'))