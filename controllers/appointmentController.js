import Appointment from '../models/appointment.js';
import { AppError } from '../utils/AppError.js';

// Create appointment
export const createAppointment = async (req, res, next) => {
  console.log('Creating appointment with data:', req.body);
  try {
    const { title, description,date, startTime, endTime, participant, staff, meetingType, location,
      notes, agenda, meetingLink } = req.body;

    // Basic validation
    if (!title || !description || !startTime || !endTime || !participant || !staff) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: title, description, startTime, endTime, participant, staff'
      });
    }
    let start_date = new Date(date);
    let end_date = new Date(date);
    const [hours, minutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    // Set the new hours and minutes on the Date object
    start_date.setUTCHours(hours);
    start_date.setUTCMinutes(minutes);
    start_date.setUTCSeconds(0);
    start_date.setUTCMilliseconds(0);
    end_date.setUTCHours(endHours);
    end_date.setUTCMinutes(endMinutes);
    end_date.setUTCSeconds(0);
    end_date.setUTCMilliseconds(0);
    // Get the new merged timestamp string
    const mergedTimestamp = start_date.toISOString();
    const mergedEndTimestamp = end_date.toISOString();
    console.log(mergedTimestamp);
    console.log(mergedEndTimestamp);


    const appointmentData = {
      title,
      description,
      startTime: mergedTimestamp,
      endTime: mergedEndTimestamp,
      date: date,
      participant,
      staff,
      meetingType: meetingType || 'in-person',
      location: location || '',
      notes: notes || '',
      agenda: agenda || '',
      meetingLink: meetingLink || ''
    };

    const appointment = await Appointment.create(appointmentData);

    res.status(201).json({
      status: 'success',
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    next(new AppError('Failed to create appointment', 500, { cause: error }));
  }
};

// Get all appointments with optional filtering
export const getAppointments = async (req, res, next) => {
  try {
    const {
      participant,
      staff,
      status,
      meetingType,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    let filter = {};

    // Build filter based on query parameters
    if (participant) filter.participant = participant;
    if (staff) filter.staff = staff;
    if (status) filter.status = status;
    if (meetingType) filter.meetingType = meetingType;

    // Date range filtering
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    const appointments = await Appointment.find(filter)
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: appointments
    });
  } catch (error) {
    next(new AppError('Failed to fetch appointments', 500, { cause: error }));
  }
};

// Get single appointment by ID
export const getAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found with that ID'
      });
    }

    res.status(200).json({
      status: 'success',
      data: appointment
    });
  } catch (error) {
    next(new AppError('Failed to fetch appointment', 500, { cause: error }));
  }
};

// Update appointment
export const updateAppointment = async (req, res, next) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      participant,
      staff,
      meetingType,
      location,
      status,
      notes,
      agenda,
      meetingLink,
      inviteSent,
      reminderSent
    } = req.body;

    // Validate end time is after start time if both are provided
    if (startTime && endTime && new Date(endTime) <= new Date(startTime)) {
      return res.status(400).json({
        status: 'error',
        message: 'End time must be after start time'
      });
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        ...(title && { title }),
        ...(description && { description }),
        ...(startTime && { startTime: new Date(startTime) }),
        ...(endTime && { endTime: new Date(endTime) }),
        ...(participant && { participant }),
        ...(staff && { staff }),
        ...(meetingType && { meetingType }),
        ...(location && { location }),
        ...(status && { status }),
        ...(notes && { notes }),
        ...(agenda && { agenda }),
        ...(meetingLink && { meetingLink }),
        ...(inviteSent !== undefined && { inviteSent }),
        ...(reminderSent !== undefined && { reminderSent })
      },
      {
        new: true, // Return updated document
        runValidators: true // Run model validators
      }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found with that ID'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Appointment updated successfully',
      data: updatedAppointment
    });
  } catch (error) {
    next(new AppError('Failed to update appointment', 500, { cause: error }));
  }
};

// Delete appointment
export const deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found with that ID'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Appointment deleted successfully',
      data: null
    });
  } catch (error) {
    next(new AppError('Failed to delete appointment', 500, { cause: error }));
  }
};

// Send invitation
export const sendInvite = async (req, res, next) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found with that ID'
      });
    }

    // Simulate sending email invitation
    console.log('Sending invitation email...');
    console.log(`To: Participant - ${appointment.participant}`);
    console.log(`To: Staff - ${appointment.staff}`);
    console.log(`Subject: Appointment Invitation: ${appointment.title}`);
    console.log(`Time: ${appointment.startTime}`);
    console.log(`Location: ${appointment.location}`);

    // Update appointment to mark invite as sent
    appointment.inviteSent = true;
    await appointment.save();

    res.status(200).json({
      status: 'success',
      message: 'Invitation sent successfully',
      data: appointment
    });
  } catch (error) {
    next(new AppError('Failed to send invitation', 500, { cause: error }));
  }
};

// Get appointments by student/participant
export const getStudentAppointments = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { status, upcoming } = req.query;

    let filter = { participant: studentId };

    if (status) filter.status = status;
    if (upcoming === 'true') {
      filter.startTime = { $gte: new Date() };
    }

    const appointments = await Appointment.find(filter)
      .sort({ startTime: 1 })
      .exec();

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(new AppError('Failed to fetch student appointments', 500, { cause: error }));
  }
};

// Get appointments by staff member
export const getStaffAppointments = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { status, date, upcoming } = req.query;

    let filter = { staff: staffId };

    if (status) filter.status = status;
    if (upcoming === 'true') {
      filter.startTime = { $gte: new Date() };
    }

    // Filter by specific date
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);

      filter.startTime = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const appointments = await Appointment.find(filter)
      .sort({ startTime: 1 })
      .exec();

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(new AppError('Failed to fetch staff appointments', 500, { cause: error }));
  }
};

