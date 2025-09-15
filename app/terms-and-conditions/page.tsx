"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function TermsAndConditions() {
  const router = useRouter();

  const handleBack = () => {
    // First try to go back in browser history
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback to dashboard if no history
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 via-orange-50 to-yellow-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <Button
              variant="outline"
              onClick={handleBack}
              className="mb-6"
            >
              ← Back
            </Button>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Terms & Conditions - Business
            </h1>
            <div className="text-gray-600 mb-4">
              <p><strong>Effective Date:</strong> 29th August 2025</p>
              <p><strong>Company:</strong> Digital Legion Ltd ("we," "our," "us")</p>
              <p><strong>Platform:</strong> Roundi ("the Platform")</p>
            </div>
          </div>

          <div className="prose max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                1. Introduction
              </h2>
              <p className="text-gray-700 mb-4">
                These Terms & Conditions ("Terms") set out the legal agreement between Digital Legion Ltd, the operator of Roundi, and you, the business ("you," "your," or "Client") using the Platform. By creating a business account or using Roundi, you agree to be bound by these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                2. Services Provided
              </h2>
              <p className="text-gray-700 mb-4">
                Roundi is a delivery route planning and management platform designed for businesses. The Platform enables you to:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
                <li>Schedule and assign deliveries</li>
                <li>Allocate parcels to drivers</li>
                <li>Optimize delivery routes</li>
                <li>Track orders in real time</li>
                <li>Collect customer ratings and feedback</li>
              </ul>
              <p className="text-gray-700 mb-4">
                We provide software only. We are not a courier or delivery company and do not employ or control your drivers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                3. Business Responsibilities
              </h2>
              <p className="text-gray-700 mb-4">
                By using Roundi, you agree to:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
                <li>Provide accurate information about your business, orders, and customers</li>
                <li>Ensure your drivers are licensed, insured, and compliant with all applicable laws</li>
                <li>Use the Platform only for lawful business purposes</li>
                <li>Keep your account credentials secure and confidential</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                4. Fees & Payments
              </h2>
              <div className="text-gray-700 mb-4">
                <p className="mb-2">Use of Roundi may require subscription or usage-based fees as agreed during sign-up.</p>
                <p className="mb-2">All fees are payable through our approved payment processors (e.g., Instasend, Paystack).</p>
                <p className="mb-2">Fees are non-refundable except where required by law.</p>
                <p className="mb-2">Failure to pay may result in suspension or termination of your account.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                5. Limitations of Liability
              </h2>
              <div className="text-gray-700 mb-4">
                <p className="mb-2">Roundi is a planning and management tool. We do not guarantee the performance, reliability, or conduct of your drivers.</p>
                <p className="mb-2">Digital Legion Ltd will not be liable for delays, losses, damages, or disputes arising from your delivery operations.</p>
                <p className="mb-2">Our total liability under these Terms, if required by law, is limited to the total fees you paid to us in the three (3) months prior to the claim.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                6. Data & Privacy
              </h2>
              <div className="text-gray-700 mb-4">
                <p className="mb-2">You retain ownership of the data you upload to Roundi.</p>
                <p className="mb-2">We may process your data to provide, maintain, and improve the Platform.</p>
                <p className="mb-2">We comply with applicable data protection laws. Please see our Privacy Policy for details.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                7. Intellectual Property
              </h2>
              <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
                <li>All rights, title, and interest in the Roundi software, trademarks, and related materials remain with Digital Legion Ltd</li>
                <li>You are granted a limited, non-transferable, non-exclusive license to use the Platform for your business operations</li>
                <li>You may not copy, resell, or reverse engineer the Platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                8. Termination
              </h2>
              <div className="text-gray-700 mb-4">
                <p className="mb-2">We may suspend or terminate your access if:</p>
                <ul className="list-disc list-inside ml-4 mb-4">
                  <li>You fail to pay subscription fees</li>
                  <li>You provide false or misleading information</li>
                  <li>You misuse the Platform or breach these Terms</li>
                </ul>
                <p className="mb-2">You may terminate your subscription at any time by providing notice via the Platform. No refunds will be issued for unused subscription periods.</p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                9. Governing Law & Dispute Resolution
              </h2>
              <ul className="list-disc list-inside text-gray-700 mb-4 ml-4">
                <li>These Terms are governed by the laws of Kenya</li>
                <li>Any dispute will first be resolved amicably between the parties. If unresolved, it shall be referred to binding arbitration in Nairobi under Kenyan law</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                10. Changes to Terms
              </h2>
              <p className="text-gray-700 mb-4">
                We may update these Terms from time to time. Any changes will be communicated through the Platform or by email. Continued use of Roundi after updates means you accept the revised Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                11. Contact Information
              </h2>
              <p className="text-gray-700 mb-4">
                For questions or support, please contact:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">
                  <strong>Email:</strong> support@roundi.africa<br />
                  <strong>Physical Address:</strong> Protectorate Flats, Mamlaka Road, Nairobi Kenya<br />
                  <strong>Phone Number:</strong> 0722235314
                </p>
              </div>
            </section>
          </div>

          <div className="border-t pt-6 mt-8">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <Button
                variant="outline"
                onClick={handleBack}
                className="w-full sm:w-auto"
              >
                ← Back
              </Button>
              <Button
                onClick={handleBack}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                I Understand
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}