/* eslint-env mocha */
import request from 'supertest';
import httpStatus from 'http-status';
import { expect } from 'chai';

import { auth, baseURL, app } from './common.integration.js';

const testMessageObject = {
    to: ['user1', 'user2'],
    subject: 'Test Message',
    message: 'Test post please ignore',
};

describe('Thread API:', () => {
    describe('GET /thread/:originalMessageId', () => {
        let originalMessageId;
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
                request(app)
                .post(`${baseURL}/message/reply/${originalMessageId}`)
                .set('Authorization', `Bearer ${auth}`)
                .send(responseMessageObject)
                .then((response) => {
                    responseMessageId = response.body.id;
                });
            }));

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
    });
});
