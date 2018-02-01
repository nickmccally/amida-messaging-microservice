/* eslint-env mocha */
import request from 'supertest';
import httpStatus from 'http-status';
import { expect } from 'chai';

import { auth, auth2, baseURL, app } from './common.integration.js';


const testMessageObject = {
    to: ['user1', 'user2'],
    subject: 'Test Message',
    message: 'Test post please ignore',
};

const inaccessibleMessageObject = {
    to: ['user007'],
    subject: 'For your eyes only',
    message: '*Self destruct*',
};

describe('Thread API:', () => {
    describe('GET /thread/', () => {
        let originalMessageId;
        let lastCreatedAt;

        const responseMessageObject = {
            to: ['user1', 'user2'],
            subject: 'Test Message',
            message: 'Response post please ignore',
        };

        before(() => request(app)
            .post(`${baseURL}/message/send`)
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .then((message) => {
                originalMessageId = message.body.originalMessageId;
                return request(app)
                .post(`${baseURL}/message/reply/${originalMessageId}`)
                .set('Authorization', `Bearer ${auth}`)
                .send(responseMessageObject)
                .then((response) => {
                    lastCreatedAt = response.body.createdAt;
                });
            })
            .then(() => request(app)
                .post(`${baseURL}/message/send`)
                .set('Authorization', `Bearer ${auth2}`)
                .send(inaccessibleMessageObject)
            )
        );

        it('should return tread summaries', () => request(app)
            .get(`${baseURL}/thread`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then((res) => {
                expect(res.body).to.be.an('array');
                expect(res.body.length).to.equal(1);
                expect(res.body[0].originalMessageId).to.equal(originalMessageId);
                expect(res.body[0].mostRecent).to.equal(lastCreatedAt);
                expect(res.body[0].unread).to.equal(false);
                expect(res.body[0].count).to.equal(2);
                expect(res.body[0].subject).to.equal(testMessageObject.subject);
            })
        );
    });

    describe('GET /thread/:originalMessageId', () => {
        let originalMessageId;
        let inaccessibleMessageId;
        let responseMessageId;

        const responseMessageObject = {
            to: ['user1', 'user2'],
            subject: 'Test Message',
            message: 'Response post please ignore',
        };

        before(() => request(app)
            .post(`${baseURL}/message/send`)
            .set('Authorization', `Bearer ${auth}`)
            .send(testMessageObject)
            .then((message) => {
                originalMessageId = message.body.originalMessageId;
                return request(app)
                .post(`${baseURL}/message/reply/${originalMessageId}`)
                .set('Authorization', `Bearer ${auth}`)
                .send(responseMessageObject)
                .then((response) => {
                    responseMessageId = response.body.id;
                });
            })
            .then(() => request(app)
                .post(`${baseURL}/message/send`)
                .set('Authorization', `Bearer ${auth2}`)
                .send(inaccessibleMessageObject)
                .then((message) => {
                    inaccessibleMessageId = message.body.originalMessageId;
                })
            )
        );

        it('should return OK', () => request(app)
            .get(`${baseURL}/thread/${originalMessageId}`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK));

        it('should return an array of messages with ids in reply order', () => request(app)
            .get(`${baseURL}/thread/${originalMessageId}`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then((res) => {
                expect(res.body).to.be.an('array');
                expect(res.body.map(body => body.id)).to.deep.equal(
                    [originalMessageId, responseMessageId]);
            }));

        it('should return an array with bodies matching the specified messages', () =>
            request(app)
            .get(`${baseURL}/thread/${originalMessageId}`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.OK)
            .then((res) => {
                const messageRequests = [testMessageObject, responseMessageObject];
                res.body.forEach((message, index) =>
                    expect(message).to.deep.include(messageRequests[index]));
            }));

        it('should 404 with unfound id', () =>
            request(app)
            .get(`${baseURL}/thread/-1`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.NOT_FOUND)
        );

        it('should 404 with inaccessible id', () =>
            request(app)
            .get(`${baseURL}/thread/${inaccessibleMessageId}`)
            .set('Authorization', `Bearer ${auth}`)
            .expect(httpStatus.NOT_FOUND)
        );
    });
});
