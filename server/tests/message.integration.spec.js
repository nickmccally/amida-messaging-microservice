
/* eslint-disable */

import request from 'supertest-as-promised';
import httpStatus from 'http-status';
import chai, { expect } from 'chai';
import app from '../../index';
import p from '../../package';
import config from '../../config/config'
import {
    Message,
    sequelize
} from '../../config/sequelize';

chai.use(require('chai-datetime'));
chai.use(require('chai-date-string'));

const version = p.version.split('.').shift();
const baseURL = (version > 0 ? `/api/v${version}` : '/api');
const auth = config.testToken;
const auth2 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXIyIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiYWRtaW4iOnRydWV9.IXN3UeBdUHLxVLHEk9a7IuY6DVQcnuA8ykxRR6JdC_k';
const authBad = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InVzZXJCYWQiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJhZG1pbiI6dHJ1ZX0.Bht75P-tmchDXssNb58r8mzwe4rHpNZVNzYHQtzfp5k';

const testMessageObject = {
    to: ['user1','user2'],
    from: 'user0',
    subject: 'Test Message',
    message: 'Test post please ignore',
};

const testMessageArray = [];
const fromArray = ['user0','user1','user2','user3'];
const MessageUnscoped = Message.unscoped();
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
});

describe('Message API:', function () {

    before(() => Message.sync({force: true}));
    
    after(() => Message.destroy({
        where: {},
        truncate: true
    }));

    describe('POST /message/send', function () {

        it('should return OK', () => request(app)
            .post(`${baseURL}/message/send`)
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

        it('sender must match JWT user', () => {
            let newTestMessageObject = { ...testMessageObject, from: 'fakeUser' };
            return request(app)
                .post(baseURL + '/message/send')
                .set('Authorization', `Bearer ${auth}`)
                .send(newTestMessageObject)
                .expect(httpStatus.FORBIDDEN)
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

    describe('POST /message/reply/:messageId', () => {

        const goodReplyMessageObject = {
            to: ['user1','user0'],
            from: 'user2',
            subject: 'RE: Test Message',
            message: 'Test reply please ignore',
        };

        const badReplyMessageObject = {
            to: ['user1','user0'],
            from: 'userBad',
            subject: 'RE: Test Message',
            message: 'Bad reply please ignore',
        };

        const secondReplyMessageObject = {
            to: ['user1','user0'],
            from: 'user2',
            subject: 'RE: RE: Test Message',
            message: 'I have to keep sending replies',
        };

        let messageId;
        let originalMessageId;
        
        before(() => request(app)
            .post(`${baseURL}/message/send`)
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .expect(httpStatus.OK)
            .then((origMsg) => {
                originalMessageId = origMsg.body.originalMessageId;
                return Message.scope({ method: ['forUser', {username: 'user2'}] })
                              .findOne({where: {originalMessageId}});
            })
            .then((message) => {
                messageId = message.id;
                return;
            })
        );

        it('should return OK', () => request(app)
            .post(`${baseURL}/message/reply/${messageId}`)
            .set('Authorization', `Bearer ${auth2}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
        );

        it('should return the response message owned by the sender', () => request(app)
            .post(`${baseURL}/message/reply/${messageId}`)
            .set('Authorization', `Bearer ${auth2}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
            .then((res) => {
                expect(res.body.to).to.deep.equal(goodReplyMessageObject.to);
                expect(res.body.from).to.equal(goodReplyMessageObject.from);
                expect(res.body.owner).to.equal(goodReplyMessageObject.from);
                expect(res.body.subject).to.equal(goodReplyMessageObject.subject);
                expect(res.body.message).to.equal(goodReplyMessageObject.message);
                expect(res.body.originalMessageId).to.equal(originalMessageId);
                expect(res.body.parentMessageId).to.equal(messageId);
            })
        );

        it('should create new messages in the DB with appropriate threaded message IDs', () => request(app)
            .post(`${baseURL}/message/reply/${messageId}`)
            .set('Authorization', `Bearer ${auth2}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
            .then((res) => {
                // Message 1: owned by respondent (user2)
                const m1 = Message.findOne({where: {
                    owner: goodReplyMessageObject.from,
                    parentMessageId: messageId
                }});

                // Message 2: owned by user0
                const m2 = Message.findOne({where: {
                    owner: goodReplyMessageObject.to[0],
                    parentMessageId: messageId
                }});

                // Message 3: owned by user1
                const m3 = Message.findOne({where: {
                    owner: goodReplyMessageObject.to[1],
                    parentMessageId: messageId
                }});

                return Promise.join(m1, m2, m3, (res1, res2, res3) => {
                    expect(res1.originalMessageId).to.equal(originalMessageId);
                    expect(res1.message).to.equal(goodReplyMessageObject.message);
                    expect(res2.originalMessageId).to.equal(originalMessageId);
                    expect(res2.message).to.equal(goodReplyMessageObject.message);
                    expect(res3.originalMessageId).to.equal(originalMessageId);
                    expect(res3.message).to.equal(goodReplyMessageObject.message);
                });
            })
        );

        it('sender must match JWT user', () => {
            let newReplyMessageObject = { ...goodReplyMessageObject, from: 'fakeUser' };
            return request(app)
                .post(`${baseURL}/message/reply/${messageId}`)
                .set('Authorization', `Bearer ${auth2}`)
                .send(newReplyMessageObject)
                .expect(httpStatus.FORBIDDEN)
        });

        it('should return an error if the messageId does not exist', () => request(app)
            .post(`${baseURL}/message/reply/99999`)
            .set('Authorization', `Bearer ${auth2}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.NOT_FOUND)
        );

        it('should not find the parent message if the sender was not a recipient of the message specified', () => request(app)
            .post(`${baseURL}/message/reply/${messageId}`)
            .set('Authorization', `Bearer ${authBad}`)
            .send(badReplyMessageObject)
            .expect(httpStatus.NOT_FOUND)
        );

    });

    //parameters: from, summary, limit
    describe('GET /message/list', function () {
        let userName;
        let limit = 2;
        let summary = true;

        before(done => {
            Message.destroy({
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
            }).then(() => done());
        });

        it('should return OK', () => request(app)
            .get(baseURL + '/message/list')
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
        );

        // this cannot be tested correctly without auth microservice.
        // Just returning all messages for now, without considering the owner
        it('should return all Messages addressed to a user', () => request(app)
            .get(baseURL + '/message/list')
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then((res) => {
                expect(res.body).to.be.an('array');
                expect(res.body.from).to.equal(testMessageArray.from);
                expect(res.body.to).to.equal(testMessageArray.to);
                return;
            })
        );

        it('has an option to limit Messages returned', () => request(app)
            .get(baseURL + '/message/list?limit=' + limit)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then(res => {
                expect(res.body).to.be.an('array');
                expect(res.body.length).to.be.at.most(limit);
                return;
            })
        );

        it('has an option to limit by sender', () => request(app)
            .get(baseURL + '/message/list?from=' + userName)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then(res => {
                expect(res.body).to.be.an('array');
                expect(res.body[0].from).to.equal(testMessageArray[0].from);
                expect(res.body[0].to).to.deep.equal(testMessageArray[0].to);
                return;
            })
        );

        it('has an option to return summaries', () => request(app)
            .get(baseURL + '/message/list?summary=' + summary)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then(res => {
                expect(res.body).to.be.an('array');
                expect(res.body[0].from).to.equal(testMessageArray[0].from);
                expect(res.body[0].to).to.be.undefined;
                expect(res.body[0].message).to.be.undefined;
                return;
            })
        );

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
        
        before(() => request(app)
            .post(`${baseURL}/message/send`)
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .expect(httpStatus.OK)
            .then((message) => {
                messageId = message.body.id;
                return;
            })
        );

        it('should return OK', () => request(app)
            .get(`${baseURL}/message/get/${messageId}`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
        );

        it('should return the specified Message', done => {
            request(app)
                .get(`${baseURL}/message/get/${messageId}`)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.deep.include(testMessageObject);
                    done();
                })
                .catch(done);
        });

        it('should mark the Message retrieved as read', done => {
            request(app)
                .get(`${baseURL}/message/get/${messageId}`)
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
        
        beforeEach(() => Message
            .destroy({
                where: {},
                truncate: true
            }).then(() => request(app)
                .post(`${baseURL}/message/send`)
                .set('Authorization', `Bearer ${auth}`)
                .send(testMessageObject)
                .expect(httpStatus.OK)
                .then((message) => {
                    messageId = message.body.id;
                    return;
                }))
        );

        it('should return OK', () => request(app)
                .delete(baseURL + '/message/delete/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
        );

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

        it('should delete the message from the DB', done => {
            request(app)
                .delete(baseURL + '/message/delete/' + messageId)
                .set('Authorization', `Bearer ${auth}`)
                .expect(httpStatus.OK)
                .then(res => {
                    let id = res.body.id;
                    Message.findById(id)
                        .then(message => {
                            expect(message).to.be.null;
                            done();
                        });
                })
                .catch(done);
        });

    });
    
});