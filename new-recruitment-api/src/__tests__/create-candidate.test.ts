import { Application } from "express";
import { setupApp } from "../app";
import { setupDb } from "../db";
import request from "supertest";

describe('Create Candidate', () => {
    let app: Application;

    beforeAll(async () => {
        await setupDb(); 
        app = await setupApp();
    })

    it('should create a new candidate successfully', async () => {
        const candidateData = {
            firstName: "Piotr",
            lastName: "Zawa", 
            email: "test@test.pl",
            phone: "123-456-789",
            experienceYears: 5,
            recruiterNotes: "Good candidate",
            jobOfferIds: [1, 2] 
        };

        const response = await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(201);

        expect(response.body.candidate.firstName).toBe(candidateData.firstName);
        expect(response.body.candidate.email).toBe(candidateData.email);
    });

    it('should return 400 when firstName is missing', async () => {
        const candidateData = {
            lastName: "Zawa",
            email: "test@test.pl",
            phone: "123-456-789",
            jobOfferIds: [1]
        };

        await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(400);
    });

    it('should return 400 when email is invalid', async () => {
        const candidateData = {
            firstName: "Piotr",
            lastName: "Zawa",
            email: "invalid-email",
            phone: "123-456-789",
            jobOfferIds: [1]
        };

        await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(400);
    });

    it('should return 400 when phone format is invalid', async () => {
        const candidateData = {
            firstName: "Piotr",
            lastName: "Zawa",
            email: "test@test.pl",
            phone: "+1234567890", 
            jobOfferIds: [1]
        };

        await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(400);
    });

    it('should return 400 when jobOfferIds is empty', async () => {
        const candidateData = {
            firstName: "Piotr",
            lastName: "Zawa",
            email: "test@test.pl",
            phone: "123-456-789",
            jobOfferIds: [] as number[]
        };

        await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(400);
    });

    it('should return 400 when experienceYears is negative', async () => {
        const candidateData = {
            firstName: "Piotr",
            lastName: "Zawa",
            email: "test@test.pl",
            phone: "123-456-789",
            experienceYears: -2,
            jobOfferIds: [1]
        };

        await request(app)
            .post('/candidates')
            .send(candidateData)
            .expect(400);
    });
})
