import { Request, Response, Router } from "express";
import { getDb } from "./db";

export class CandidatesController {
    readonly router = Router();

    constructor() {
        this.router.get('/candidates', this.getAll.bind(this));
        this.router.post('/candidates', this.create.bind(this));
    }

    async getAll(req: Request, res: Response) {
        try {
            const db = getDb();
            
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            
            if (page < 1) {
                return res.status(400).json({ 
                    message: "Page number must be greater than 0" 
                });
            }
            
            if (limit < 1 || limit > 100) {
                return res.status(400).json({ 
                    message: "Limit must be between 1 and 100" 
                });
            }
            
            const offset = (page - 1) * limit;
            
            const totalResult = await db.get('SELECT COUNT(*) as total FROM Candidate');
            const total = totalResult.total;
            
            const candidates = await db.all(
                'SELECT * FROM Candidate ORDER BY id DESC LIMIT ? OFFSET ?',
                [limit, offset]
            );
            
            const totalPages = Math.ceil(total / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;
            
            res.json({
                data: candidates,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: total,
                    itemsPerPage: limit,
                    hasNextPage,
                    hasPreviousPage
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Database error' });
        }
    }

    async create(req: Request, res: Response) {
        try {
            const { firstName, lastName, email, phone, experienceYears, recruiterNotes, jobOfferIds } = req.body;
            
            const errors: string[] = [];
            
            if (!firstName) {
                errors.push("First name is required");
            }
            
            if (!lastName) {
                errors.push("Last name is required");
            }
            
            if (!email) {
                errors.push("Email is required");
            }
            
            if (!jobOfferIds || !Array.isArray(jobOfferIds) || jobOfferIds.length === 0) {
                errors.push("At least one job offer ID is required");
            }
            
            if (email && !/\S+@\S+\.\S+/.test(email)) {
                errors.push("Invalid email format");
            }
            
            if (phone && !/^\d{3}-\d{3}-\d{3}$/.test(phone)) {
                errors.push("Phone number must be in format xxx-xxx-xxx");
            }
            
            if (experienceYears !== undefined) {
                if (typeof experienceYears !== 'number' || !Number.isInteger(experienceYears) || experienceYears < 0) {
                    errors.push("Experience years must be a non-negative integer");
                }
            }
            
            if (jobOfferIds && Array.isArray(jobOfferIds)) {
                const invalidIds = jobOfferIds.filter(id => !Number.isInteger(id) || id <= 0);
                if (invalidIds.length > 0) {
                    errors.push("All job offer IDs must be positive integers");
                }
            }
            
            if (errors.length > 0) {
                return res.status(400).json({ 
                    message: "Validation failed",
                    errors: errors
                });
            }
            
            const db = getDb();
            
            const existingCandidate = await db.get('SELECT id FROM Candidate WHERE email = ?', [email]);
            if (existingCandidate) {
                return res.status(409).json({ 
                    message: "Candidate with this email already exists" 
                });
            }
            
            const placeholders = jobOfferIds.map(() => '?').join(',');
            const existingOffers = await db.all(
                `SELECT id FROM JobOffer WHERE id IN (${placeholders})`,
                jobOfferIds
            );
            
            if (existingOffers.length !== jobOfferIds.length) {
                return res.status(400).json({ 
                    message: "Validation failed",
                    errors: ["One or more job offers do not exist"] 
                });
            }
            
            const result = await db.run(
                'INSERT INTO Candidate (firstName, lastName, email, phone, experienceYears, recruiterNotes, consentDate) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [firstName, lastName, email, phone || null, experienceYears || null, recruiterNotes || null, new Date().toISOString()]
            );
            
            const candidateId = result.lastID;
            
            for (const jobOfferId of jobOfferIds) {
                await db.run(
                    'INSERT INTO CandidateJobOffer (candidate_id, job_offer_id) VALUES (?, ?)',
                    [candidateId, jobOfferId]
                );
            }
            
            const candidate = await db.get('SELECT * FROM Candidate WHERE id = ?', [candidateId]);
            const linkedJobOffers = await db.all(
                `SELECT jo.* FROM JobOffer jo 
                 INNER JOIN CandidateJobOffer cjo ON jo.id = cjo.job_offer_id 
                 WHERE cjo.candidate_id = ?`,
                [candidateId]
            );
            
            try {
                const response = await fetch('http://localhost:4040/candidates', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': '0194ec39-4437-7c7f-b720-7cd7b2c8d7f4'
                    },
                    body: JSON.stringify({
                        firstName,
                        lastName,
                        email
                    })
                });
                
                if (!response.ok) {
                    console.warn('Failed to sync with legacy API:', await response.text());
                }
            } catch (legacyError) {
                console.warn('Legacy API sync failed:', legacyError);
            }
            
            res.status(201).json({
                message: "Candidate created successfully",
                candidate: {
                    ...candidate,
                    jobOffers: linkedJobOffers
                }
            });
        } catch (error) {
            console.error('Database error:', error);
            res.status(500).json({ error: 'Database error' });
        }
    }
}
