const utils = require('./utils');

const {Return} = require("./protocol/api/api_pb");

function returnFromBase64(ret){
    return Return.deserializeBinary(utils.base64DecodeFromString(ret));
}

module.exports = {
    returnFromBase64
};
