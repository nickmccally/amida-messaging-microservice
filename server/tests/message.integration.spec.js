
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
import _ from 'lodash';

chai.use(require('chai-datetime'));

const version = p.version.split('.').shift();
const baseURL = (version > 0 ? `/api/v${version}` : '/api');

const testMessageObject = {
    to: ['user1','user2'],
    from: 'user0',
    subject: 'Test Message',
    message: 'Test post please ignore',
};

describe('Message API:', function () {

    before(() => Message.sync({force: true}));
    
    after(() => Message.destroy({
        where: {},
        truncate: true
    }));

    describe('POST /message/send', function () {

        it('should return OK', () => request(app)
            .post(baseURL + '/message/send')
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
            to: ['user2','user0'],
            from: 'user1',
            subject: 'RE: RE: Test Message',
            message: 'I have to keep sending replies',
        };

        let messageId;
        
        before(() => Message
            .create(testMessageObject)
            .then((message) => {
                messageId = message.id;
                return;
            })
        );

        it('should return OK', () => request(app)
            .post(`${baseUrl}/message/reply/${messageId}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
        );

        it('should return the response message owned by the sender', () => request(app)
            .post(`${baseUrl}/message/reply/${messageId}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
            .then((res) => {
                expect(res.body.to).to.deep.equal(goodReplyMessageObject.to);
                expect(res.body.from).to.equal(goodReplyMessageObject.from);
                expect(res.body.owner).to.equal(goodReplyMessageObject.from);
                expect(res.body.subject).to.equal(goodReplyMessageObject.subject);
                expect(res.body.message).to.equal(goodReplyMessageObject.message);
                expect(res.body.originalMessageId).to.equal(messageId);
                expect(res.body.parentMessageId).to.equal(messageId);
            })
        );

        it('should create new messages in the DB with appropriate threaded message IDs', () => request(app)
            .post(`${baseUrl}/message/reply/${messageId}`)
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

                Promise.join(m1, m2, m3, (res1, res2, res3) => {
                    expect(res1.originalMessageId).to.equal(messageId);
                    expect(res1.message).to.equal(goodReplyMessageObject.message);
                    expect(res2.originalMessageId).to.equal(messageId);
                    expect(res2.message).to.equal(goodReplyMessageObject.message);
                    expect(res3.originalMessageId).to.equal(messageId);
                    expect(res3.message).to.equal(goodReplyMessageObject.message);
                });
            })
        );

        it('should return an error if the messageId does not exist', () => request(app)
            .post(`${baseUrl}/message/reply/99999`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.NOT_FOUND)
        );

        it('should not allow a reply if the sender was not a recipient of the message specified', () => request(app)
            .post(`${baseUrl}/message/reply/${messageId}`)
            .send(badReplyMessageObject)
            .expect(httpStatus.FORBIDDEN)
        );

        it('should maintain original ID while incrementing parent ID on multiple replies', () => request(app)
            .post(`${baseUrl}/message/reply/${messageId}`)
            .send(goodReplyMessageObject)
            .expect(httpStatus.OK)
            .then((res1) => {
                let replyId = res.body.id;
                return request(app)
                    .post(`${baseUrl}/message/reply/${replyId}`)
                    .send(secondReplyMessageObject)
                    .expect(httpStatus.OK)
                    .then((res2) => {
                        expect(res2.body.to).to.deep.equal(secondReplyMessageObject.to);
                        expect(res2.body.from).to.equal(secondReplyMessageObject.from);
                        expect(res2.body.owner).to.equal(secondReplyMessageObject.from);
                        expect(res2.body.subject).to.equal(secondReplyMessageObject.subject);
                        expect(res2.body.message).to.equal(secondReplyMessageObject.message);
                        expect(res2.body.originalMessageId).to.equal(messageId);
                        expect(res2.body.parentMessageId).to.equal(replyId);
                        return;
                    })
            })
        );

    });

    describe('GET /message/list/:userId', function () {

        let userId;

        before(done => {
            Message.create(testMessageObject)
                .then(message => {
                    userId = message.from;
                    done();
                });
        });

        it('should return OK', done => {
            request(app)
                .get(baseURL + '/message/list' + userId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.text).to.equal('OK');
                    done();
                })
                .catch(done);
        });

        it('should return all Message addressed to a user', done => {
            request(app)
                .get(baseURL + '/message/list' + userId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body)
                        .to.be.an('array')
                        .that.deep.includes(testMessageObject);
                    done();
                })
                .catch(done);
        });

        // TODO: Ruchita to write this test
        it('has an option to limit Message returned');

        // TODO: Ruchita to write this test
        it('has an option to limit by sender');

        // TODO: Ruchita to write this test
        it('has an option to return summaries');

    });
    
    describe('GET /message/count/:userId', function () {

        let userId;

        before(done => {
            Message.destroy({
                where: {},
                truncate: true
            }).then(() => {
                Message.create(testMessageObject)
                    .then(message => {
                        userId = message.from;
                        done();
                    });
            });
        });

        it('should return OK', done => {
            request(app)
                .get(baseURL + '/message/count' + userId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.text).to.equal('OK');
                    done();
                })
                .catch(done);
        });

        it('should return a count for total Messages', done => {
            request(app)
                .get(baseURL + '/message/count' + userId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.total).to.equal(1);
                    done();
                })
                .catch(done);
        });

        it('should return a count for unread Messages', done => {
            request(app)
                .get(baseURL + '/message/count' + userId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.unread).to.equal(1);
                    done();
                })
                .catch(done);
        });

    });
    
    describe('GET /message/get/:messageId', function () {

        let messageId;
        
        before(done => {
            Message.create(testMessageObject)
                .then(message => {
                    messageId = message.id;
                    done();
                });
        });

        it('should return OK', done => {
            request(app)
                .get(baseURL + '/message/get' + messageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.text).to.equal('OK');
                    done();
                })
                .catch(done);
        });

        it('should return the specified Message', done => {
            request(app)
                .get(baseURL + '/message/get' + messageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.deep.include(testMessageObject);
                    done();
                })
                .catch(done);
        });

        it('should mark the Message retrieved as read', done => {
            request(app)
                .get(baseURL + '/message/get' + messageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body.readAt).to.not.be.null;
                    expect(res.body.readAt).to.be.a('Date');
                    done();
                })
                .catch(done);
        });

    });

    // TODO: this one is going to be hard
    describe('GET /message/thread/:originalMessageId', () => {
        
        let messageId;
        
        before(done => {
            Message.create(testMessageObject)
                .then(message => {
                    originalMessageId = message.originalMessageId;
                    done();
                });
        });

        // TODO: create a real response message here

        it('should return OK', done => {
            request(app)
                .get(baseURL + '/message/thread' + originalMessageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.text).to.equal('OK');
                    done();
                })
                .catch(done);
        });

        it('should return an array of message IDs, starting with the original message', done => {
            request(app)
                .get(baseURL + '/message/thread' + originalMessageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.be.an.array;
                    // TODO check specific IDs
                    done();
                })
                .catch(done);
        });

    });

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

        xit('should return OK', done => {
            request(app)
                .delete(baseURL + '/message/delete' + messageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.text).to.equal('OK');
                    done();
                })
                .catch(done);
        });

        xit('should return the deleted Message', done => {
            request(app)
                .delete(baseURL + '/message/delete' + messageId)
                .expect(httpStatus.OK)
                .then(res => {
                    expect(res.body).to.deep.include(testMessageObject);
                    done();
                })
                .catch(done);
        });

        xit('should delete the message from the DB', done => {
            request(app)
                .delete(baseURL + '/message/delete' + messageId)
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