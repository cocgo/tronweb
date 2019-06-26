const utils = require('./utils');

const {Block} = require("./protocol/core/Tron_pb");
const {SHA256} = require("./utils/crypto");

function getBlockHash(block){
    let raw = block.getBlockHeader().getRawData();
    let rawBytes = raw.serializeBinary();
    return SHA256(rawBytes);
}
function blockFromBase64(blockString){
    return Block.deserializeBinary(utils.base64DecodeFromString(blockString));
}

module.exports = {
    blockFromBase64,
    getBlockHash
};
