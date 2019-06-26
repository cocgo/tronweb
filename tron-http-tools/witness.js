const utils = require('./utils');

const {WitnessList} = require("./protocol/api/api_pb");
const {Witness} = require("./protocol/core/Tron_pb");
const {getBase58CheckAddress,SHA256} = require("./utils/crypto");

function witnessesFromWitnessListBase64(witnesslist){
    let witnesses = WitnessList.deserializeBinary(utils.base64DecodeFromString(witnesslist)).getWitnessesList();
    let output = [];
    for (let i = 0;i<witnesses.length;i++){
        let witness = witnesses[i];
        let w = witness.toObject();
        w.address = getBase58CheckAddress(Array.from(witness.getAddress()));
        output.push(w);
    }
    return output;
}

module.exports = {
    witnessesFromWitnessListBase64
};
