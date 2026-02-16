import React, { useState } from 'react';
import { Package, MapPin, User, Upload, ArrowRight, ArrowLeft, CheckCircle, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createShipment } from '../services/api';

const NewShipment = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    senderName: '', senderPhone: '', senderAddress: '',
    receiverName: '', receiverPhone: '', receiverAddress: '',
    packageWeight: '', packageType: 'Standard', description: '',
    receiverImage: null // To store the uploaded image
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, receiverImage: URL.createObjectURL(file) });
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, receiverImage: null });
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        sender_name: formData.senderName,
        sender_phone: formData.senderPhone,
        pickup_address: formData.senderAddress,
        receiver_name: formData.receiverName,
        receiver_phone: formData.receiverPhone,
        delivery_address: formData.receiverAddress,
        package_weight: formData.packageWeight ? parseFloat(formData.packageWeight) : null,
        package_type: formData.packageType,
        description: formData.description || null,
        image_url: formData.receiverImage || null,
      };
      await createShipment(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create shipment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-[#FFC000] selection:text-black">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create New Shipment</h1>
          <p className="text-gray-400">Fill in the details below to schedule a pickup.</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-[#333333] -z-10 rounded-full"></div>
          <div 
            className="absolute top-1/2 left-0 h-1 bg-[#FFC000] -z-10 rounded-full transition-all duration-500" 
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          ></div>
          
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-all ${step >= s ? 'bg-[#FFC000] border-black text-black' : 'bg-[#1A1A1A] border-black text-gray-500'}`}>
              {step > s ? <CheckCircle size={20} /> : s}
            </div>
          ))}
        </div>

        {/* Form Container */}
        <div className="bg-[#1A1A1A] rounded-[2rem] p-6 md:p-10 border border-[#333333] shadow-2xl">
          
          {/* Step 1: Sender Details */}
          {step === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><User size={24} /></div>
                Sender Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name</label>
                  <input type="text" name="senderName" value={formData.senderName} onChange={handleChange} placeholder="Your Name" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number</label>
                  <input type="tel" name="senderPhone" value={formData.senderPhone} onChange={handleChange} placeholder="+94 77 123 4567" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pickup Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input type="text" name="senderAddress" value={formData.senderAddress} onChange={handleChange} placeholder="Street address, City" className="w-full bg-black border border-[#333333] rounded-xl p-4 pl-12 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Receiver Details */}
          {step === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><MapPin size={24} /></div>
                Receiver Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receiver Name</label>
                  <input type="text" name="receiverName" value={formData.receiverName} onChange={handleChange} placeholder="Receiver Name" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Receiver Phone</label>
                  <input type="tel" name="receiverPhone" value={formData.receiverPhone} onChange={handleChange} placeholder="+94 77 123 4567" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input type="text" name="receiverAddress" value={formData.receiverAddress} onChange={handleChange} placeholder="Street address, City" className="w-full bg-black border border-[#333333] rounded-xl p-4 pl-12 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Package Info */}
          {step === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><Package size={24} /></div>
                Package Information
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Weight (kg)</label>
                  <input type="number" name="packageWeight" value={formData.packageWeight} onChange={handleChange} placeholder="0.5" className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                  <select name="packageType" value={formData.packageType} onChange={handleChange} className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors">
                    <option>Standard</option>
                    <option>Fragile</option>
                    <option>Electronics</option>
                    <option>Documents</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description</label>
                  <textarea rows="3" name="description" value={formData.description} onChange={handleChange} placeholder="Brief description of contents..." className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white focus:border-[#FFC000] focus:outline-none transition-colors resize-none"></textarea>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Verification (Image Upload) */}
          {step === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="p-2 bg-[#FFC000] rounded-lg text-black"><Camera size={24} /></div>
                Delivery Verification
              </h2>
              
              <p className="text-gray-400 text-sm leading-relaxed bg-black/50 p-4 rounded-xl border border-[#333333]">
                <strong className="text-[#FFC000]">Secure Delivery:</strong> Please upload a photo of the authorized receiver (Owner or Neighbor) or the specific location (e.g., front door) to help our driver verify the correct delivery target.
              </p>

              <div className="mt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Upload Reference Image (Owner/Neighbor)</label>
                
                {!formData.receiverImage ? (
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-[#333333] border-dashed rounded-2xl cursor-pointer bg-black hover:border-[#FFC000] hover:bg-[#FFC000]/5 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className="p-4 bg-[#1A1A1A] rounded-full mb-3 group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-gray-400 group-hover:text-[#FFC000]" />
                      </div>
                      <p className="mb-2 text-sm text-gray-400"><span className="font-bold text-[#FFC000]">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (MAX. 5MB)</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                ) : (
                  <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-[#333333] group">
                    <img src={formData.receiverImage} alt="Receiver Reference" className="w-full h-full object-cover" />
                    <button 
                      onClick={removeImage}
                      className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-3 text-center">
                        <p className="text-[#FFC000] font-bold text-sm flex items-center justify-center gap-2">
                            <CheckCircle size={16} /> Image Uploaded Successfully
                        </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#333333]">
            {step > 1 ? (
              <button 
                onClick={prevStep}
                className="px-6 py-3 rounded-xl font-bold text-white hover:text-[#FFC000] transition-colors flex items-center gap-2"
              >
                <ArrowLeft size={20} /> Back
              </button>
            ) : (
              <div></div>
            )}

            {step < 4 ? (
              <button 
                onClick={nextStep}
                className="px-8 py-3 bg-[#FFC000] text-black font-bold rounded-xl hover:bg-[#E5AC00] transition-colors shadow-lg shadow-[#FFC000]/20 flex items-center gap-2"
              >
                Next Step <ArrowRight size={20} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Confirm Shipment'} <CheckCircle size={20} />
              </button>
            )}
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default NewShipment;