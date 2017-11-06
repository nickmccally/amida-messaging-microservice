/* eslint-disable */

import request from 'supertest-as-promised';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';
import app from '../../index';
import p from '../../package';
import {
    Message,
    sequelize
} from '../../config/sequelize';
import config from '../../config/config'
import _ from 'lodash';

chai.use(require('chai-datetime'));
chai.use(require('chai-date-string'));

const version = p.version.split('.').shift();
const baseURL = (version > 0 ? `/api/v${version}` : '/api');
const auth = config.testToken;

const testMessageObject = {
    to: ['user1','user2'],
    from: 'user0',
    subject: 'Test Message',
    message: 'Test post please ignore',
};

const testMessageArray = [];
const fromArray = ['user0','user1','user2','user3'];
// 4 senders send message to 4 recipients each
fromArray.forEach(function(receiver) {
  fromArray.forEach(function(sender) {
    testMessageArray.push({
        to: fromArray,
        from: sender,
        subject: 'Test Message',
        message: 'Test post please ignore',
        owner: receiver
    })
  })
})

describe('Message API:', function () {

    before(() => Message.sync({force: true}));

    after(() => Message.destroy({
        where: {},
        truncate: true
    }));

    describe('POST /message/send', function () {

        it('should return OK', () => request(app)
            .post(baseURL + '/message/send')
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .expect(httpStatus.OK)
        );

        /**
         * Every recipient, plus the sender, gets their own version
         * of the message with the `owner` field set to their user ID.
         * Creating a message should return the sender's version of the message.
         */
        it('should return the sender\'s Message object', () => request(app)
            .post(baseURL + '/message/send')
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .expect(httpStatus.OK)
            .then(res => {
                expect(res.body.to).to.deep.equal(testMessageObject.to);
                expect(res.body.from).to.equal(testMessageObject.from);
                expect(res.body.owner).to.equal(testMessageObject.from);
                expect(res.body.subject).to.equal(testMessageObject.subject);
                expect(res.body.message).to.equal(testMessageObject.message);
                return;
            })
        );

        it('should create new Messages in the DB', done => {
            request(app)
                .post(baseURL + '/message/send')
                .set('Authorization', `Bearer ${auth}`)
                .send(testMessageObject)
                .expect(httpStatus.OK)
                .then(res => {
                    let id = res.body.id;
                    // what if- Message.findById(res.body.id)
                    Message.findById(id)
                        .then(message => {
                            expect(message.subject).to.equal(testMessageObject.subject);
                            Message.findOne({where: {owner: testMessageObject.to[0]}})
                            .then(message => {
                                //expect(message).to.deep.equal(testMessageObject); -- not working
                                expect(message.from).to.equal(testMessageObject.from);
                                expect(message.subject).to.equal(testMessageObject.subject);
                                expect(message.message).to.equal(testMessageObject.message);
                                done();
                            });
                        });
                })
                .catch(done);
        });

        it('returned message should have a createdAt timestamp', done => {
            request(app)
                .post(baseURL + '/message/send')
                .set('Authorization', `Bearer ${auth}`)
                .send(testMessageObject)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.createdAt).to.not.be.null;
                    expect(res.body.createdAt).to.not.be.undefined;
                    done();
                })
                .catch(done);
        });

        it('recipient message should have readAt set to NULL', done => {
            request(app)
                .post(baseURL + '/message/send')
                .set('Authorization', `Bearer ${auth}`)
                .send(testMessageObject)
                .expect(httpStatus.OK)
                .then(res => {
                    Message.findOne({where: {owner: testMessageObject.to[0]}})
                            .then(message => {
                                expect(message.readAt).to.be.null;
                            });
                    done();
                })
                .catch(done);
        });

        /**
         * Sent messages are considered read
         */
        it('sender message should have readAt set to createdAt time', done => {
            request(app)
                .post(baseURL + '/message/send')
                .set('Authorization', `Bearer ${auth}`)
                .send(testMessageObject)
                .expect(httpStatus.OK)
                .then(res => {
                    Message.findById(res.body.id)       //do we need to define res.body.id outside?
                        .then(message => {
                            expect(message.readAt).to.not.be.null;
                            expect(message.readAt).to.deep.equal(message.createdAt);
                            done();
                        })
                        .catch(done);
                 });
        });
    });

    // describe('POST /message/reply/:messageId', () => {

    //     let messageId;

    //     before(done => {
    //         Message.create(testMessageObject)
    //             .then(message => {
    //                 messageId = message.id;
    //                 done();
    //             });
    //     });

    //     it('should return OK', done => {
    //         request(app)
    //             .post(baseURL + '/message/send')
    //             .send(testMessageObject)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.text).to.equal('OK');
    //                 done();
    //             })
    //             .catch(done);
    //     });

    //     // TODO leaving these for Jacob to work on
    //     it('should return the response message owned by the sender');

    //     it('should create new messages in the DB with appropriate threaded message IDs');

    // });

    //parameters: from, summary, limit
    describe('GET /message/list?from=username&limit=number&summary=true', function () {

        let userName;
        let limit = 2;
        let summary = true;

        before(done => {Message.destroy({
                            where: {},
                            truncate: true
            }).then(message => {
            Message.bulkCreate(testMessageArray).then(messages => {
                userName = messages[0].from;
                done();
            });
            });
        });

        after(done => {
            Message.destroy({
                where: {},
                truncate: true
            })
            done();
        });

        it('should return OK', done => { //remove done, removed res.text
            request(app)
                .get(baseURL + '/message/list')
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
            done();
        });

        // this cannot be tested correctly without auth microservice.
        // Just returning all messages for now, without considering the owner
        it('should return all Message addressed to a user', done => {
            request(app)
                .get(baseURL + '/message/list')
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.be.an('array');  //changed res to res.body
                    expect(res.body.length).to.equal(testMessageArray.length/fromArray.length);
                    done();
                })
                .catch(done);
        });

        // TODO: Ruchita to write this test
        it('has an option to limit Message returned', done => {
            request(app)
                .get(baseURL + '/message/list?limit=' + limit)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.be.an('array');  //changed res to res.body
                    expect(res.body.length).to.equal(limit);
                    done();
                })
                .catch(done);
        });

        // TODO: Ruchita to write this test
        it('has an option to limit by sender', done => {
            request(app)
                .get(baseURL + '/message/list?from=' + userName)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.be.an('array');  //changed res to res.body
                    expect(res.body[0].from).to.equal(userName);
                    done();
                })
                .catch(done);
        });

        // TODO: Ruchita to write this test
        it('has an option to return summaries', done => {
            request(app)
                .get(baseURL + '/message/list?summary=' + summary)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.be.an('array');  //changed res to res.body
                    expect(res.body[0].to).to.be.undefined;
                    expect(res.body[0].message).to.be.undefined;
                    done();
                })
                .catch(done);
        });

    });

    // describe('GET /message/count/:userId', function () {

    //     let userId;

    //     before(done => {
    //         Message.destroy({
    //             where: {},
    //             truncate: true
    //         }).then(() => {
    //             Message.create(testMessageObject)
    //                 .then(message => {
    //                     userId = message.from;
    //                     done();
    //                 });
    //         });
    //     });

    //     it('should return OK', done => {
    //         request(app)
    //             .get(baseURL + '/message/count' + userId)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.text).to.equal('OK');
    //                 done();
    //             })
    //             .catch(done);
    //     });

    //     it('should return a count for total Messages', done => {
    //         request(app)
    //             .get(baseURL + '/message/count' + userId)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.body.total).to.equal(1);
    //                 done();
    //             })
    //             .catch(done);
    //     });

    //     it('should return a count for unread Messages', done => {
    //         request(app)
    //             .get(baseURL + '/message/count' + userId)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.body.unread).to.equal(1);
    //                 done();
    //             })
    //             .catch(done);
    //     });

    // });

    describe('GET /message/get/:messageId', function () {

        let messageId;

        before(done => {
            testMessageObject.owner = "user0"; //forcing owner to be a specific value
            Message.create(testMessageObject)
                .then(message => {
                    messageId = message.id;
                    done();
                });
        });

        after(done => {
                Message.destroy({
                    where: {},
                    truncate: true
                })
            done();
        });

        it('should return OK', () => { //removed done, removed res.text
            request(app)
                .get(baseURL + '/message/get/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
        });

        it('should return the specified Message', done => {
            request(app)
                .get(baseURL + '/message/get/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.to).to.deep.equal(testMessageObject.to);
                    expect(res.body.from).to.equal(testMessageObject.from);
                    expect(res.body.subject).to.equal(testMessageObject.subject);
                    expect(res.body.message).to.equal(testMessageObject.message);
                    //not checking for owner here because that value was forced to a string
                    done();
                })
                .catch(done);
        });

        it('should mark the Message retrieved as read', done => {
            request(app)
                .get(baseURL + '/message/get/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.readAt).to.not.be.null;
                    expect(res.body.readAt).to.be.a.dateString();
                    done();
                })
                .catch(done);
        });

    });

    // TODO: this one is going to be hard
    // describe('GET /message/thread/:originalMessageId', () => {

    //     let messageId;

    //     before(done => {
    //         Message.create(testMessageObject)
    //             .then(message => {
    //                 originalMessageId = message.originalMessageId;
    //                 done();
    //             });
    //     });

    //     // TODO: create a real response message here

    //     it('should return OK', done => {
    //         request(app)
    //             .get(baseURL + '/message/thread' + originalMessageId)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.text).to.equal('OK');
    //                 done();
    //             })
    //             .catch(done);
    //     });

    //     it('should return an array of message IDs, starting with the original message', done => {
    //         request(app)
    //             .get(baseURL + '/message/thread' + originalMessageId)
    //             .expect(httpStatus.OK)
    //             .then(res => {
    //                 expect(res.body).to.be.an.array;
    //                 // TODO check specific IDs
    //                 done();
    //             })
    //             .catch(done);
    //     });

    // });

    describe('DELETE /message/delete/:messageId', function () {

        let messageId;

        beforeEach(done => {
            Message.destroy({
                where: {},
                truncate: true
            }).then(() => {
                Message.create(testMessageObject)
                    .then(message => {
                        messageId = message.id;
                        done();
                    });
            });
        });

        it('should return OK', () => {
            request(app)
                .get(baseURL + '/message/delete/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
        });

        it('should return the deleted Message', done => {
            request(app)
                .delete(baseURL + '/message/delete/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.deep.include(testMessageObject);
                    done();
                })
                .catch(done);
        });

        it('should soft delete message', done => {
            request(app)
                .delete(baseURL + '/message/delete/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    let id = res.body.id;
                    Message.unscoped().findById(id)
                        .then(message => {
                            expect(message.isDeleted).to.equal(true);
                            done();
                        });
                })
                .catch(done);
        });

    });


    describe('PUT /message/archive/:messageId', function () {

        let messageId;

        beforeEach(done => {
            Message.destroy({
                where: {},
                truncate: true
            }).then(() => {
                Message.create(testMessageObject)
                    .then(message => {
                        messageId = message.id;
                        done();
                    });
            });
        });

        it('should return OK', () => {
            request(app)
                .get(baseURL + '/message/archive/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
        });

        it('should return the archived Message', done => {
            request(app)
                .put(baseURL + '/message/archive/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.deep.include(testMessageObject);
                    done();
                })
                .catch(done);
        });

        it('should archive message', done => {
            request(app)
                .put(baseURL + '/message/archive/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    let id = res.body.id;
                    Message.findById(id)
                        .then(message => {
                            expect(message.isArchived).to.equal(true);
                            done();
                        });
                })
                .catch(done);
        });

    });

});
