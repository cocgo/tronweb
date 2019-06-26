const {hexStr2byteArray, base64EncodeToString, base64DecodeFromString} = require("./lib/code");
const base58 = require('./lib/base58');
const TextDecoder = require('text-encoding').TextDecoder;
const btoa = require("btoa");

function base58AddressToUint8Array(address){
    let decoded = base58.decode58(address);
    let check = decoded.splice(-4, 4);
    return new Uint8Array(decoded);
}

function base64StringToString(b64){
    return Buffer.from(result.message, 'base64').toString();
}

function uint8ToBase64(u8){
    let decoder = new TextDecoder('utf8');
    return btoa(decoder.decode(u8));
}

function stringToUint8Array(str) {
    return Uint8Array.from(base64DecodeFromString(btoa(str)));
}

module.exports = {
    hexStr2byteArray,
    base64EncodeToString,
    base64DecodeFromString,
    base64StringToString,
    base58AddressToUint8Array,
    stringToUint8Array,
    uint8ToBase64
};
